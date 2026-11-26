#!/usr/bin/env bash
# The one-time setup of the AWS account (functional specification W4).
#
# Run by the maintainer, signed in to the AWS account with their own sign-in:
#
#   infra/setup/setup.sh
#
# In this order it makes: the notification topic and the budget alarm; then,
# only if the budget alarm exists, the pipeline's two identities with their
# outer limits and the bucket for Terraform's state; then it subscribes the
# address for alarm emails, and moves its own state into the bucket.
# Run again, it changes nothing that already exists.

set -euo pipefail
cd "$(dirname "$0")"

REGION="us-east-1"
STATE_KEY="setup/terraform.tfstate"
BUDGET_NAME="vd-monthly"

say() { printf '\n== %s\n' "$1"; }
fail() {
  printf '\nSetup stopped: %s\n' "$1" >&2
  exit 1
}

command -v terraform >/dev/null || fail "Terraform is not installed."
command -v aws >/dev/null || fail "The AWS command line is not installed."

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)" ||
  fail "You are not signed in to AWS."
STATE_BUCKET="vd-terraform-state-${ACCOUNT_ID}"

backend_arguments=(
  "-backend-config=bucket=${STATE_BUCKET}"
  "-backend-config=key=${STATE_KEY}"
  "-backend-config=region=${REGION}"
  "-backend-config=use_lockfile=true"
)

write_backend_file() {
  # Generated here, not committed: it is needed only once the bucket exists.
  cat >backend.tf <<'EOF'
# Written by setup.sh once the state bucket exists. Not committed.
terraform {
  backend "s3" {}
}
EOF
}

say "Preparing Terraform"
# Where the setup's state is decides how Terraform starts. The bucket existing
# does not mean the state is in it: a first run that stopped after making the
# bucket leaves the state on this machine.
STATE_ON_MACHINE=0
STATE_IN_BUCKET=0
[ -s terraform.tfstate ] && STATE_ON_MACHINE=1
if aws s3api head-object --bucket "${STATE_BUCKET}" --key "${STATE_KEY}" >/dev/null 2>&1; then
  STATE_IN_BUCKET=1
fi

if [ "${STATE_ON_MACHINE}" -eq 1 ] && [ "${STATE_IN_BUCKET}" -eq 1 ]; then
  fail "The setup's state is both on this machine (infra/setup/terraform.tfstate) and in the bucket. An earlier run stopped while moving it. Compare the two; if the bucket's copy is complete, delete the local file and run this script again."
elif [ "${STATE_IN_BUCKET}" -eq 1 ]; then
  # The setup has finished before: its state is in the bucket.
  write_backend_file
  terraform init -input=false -reconfigure "${backend_arguments[@]}"
elif [ "${STATE_ON_MACHINE}" -eq 1 ]; then
  # An earlier run stopped part-way: carry on from the state on this machine.
  rm -f backend.tf
  terraform init -input=false -reconfigure
elif aws s3api head-bucket --bucket "${STATE_BUCKET}" >/dev/null 2>&1; then
  fail "The state bucket exists but the setup's state is neither in it nor on this machine. Running on would try to create what already exists. Find the state file (the bucket keeps earlier versions for 90 days) before running this script again."
else
  # A first run.
  rm -f backend.tf
  terraform init -input=false -reconfigure
fi

say "How many copies of a function this account may run at once"
# The environments reserve 20 and 5 copies for the server and 1 each for the
# change runner. AWS always keeps 100 unreserved, so an account allowed fewer
# than 127 refuses the first deployment after the database has been made.
CONCURRENCY_LIMIT="$(aws lambda get-account-settings --region "${REGION}" \
  --query 'AccountLimit.ConcurrentExecutions' --output text 2>/dev/null || echo unknown)"
if [ "${CONCURRENCY_LIMIT}" = "unknown" ]; then
  echo "NOTE: the limit could not be read. Check it before the first deployment (docs/operations.md)."
elif [ "${CONCURRENCY_LIMIT}" -lt 127 ]; then
  echo "WARNING: this account may run ${CONCURRENCY_LIMIT} copies at once; the environments need 127."
  echo "         Ask AWS to raise the limit, or set server_concurrency = -1 in both"
  echo "         infra/environment/*.tfvars files until it is raised (docs/operations.md)."
else
  echo "The limit is ${CONCURRENCY_LIMIT}; enough."
fi

say "1 and 2. The notification topic and the budget alarm"
# The topic's policy goes with it, so that AWS Budgets may publish to the
# topic from the moment the budget exists.
terraform apply -input=false -auto-approve \
  -target=aws_sns_topic.alarms \
  -target=aws_sns_topic_policy.alarms \
  -target=aws_budgets_budget.monthly ||
  fail "The budget alarm could not be created. Nothing else was created."

aws budgets describe-budget --account-id "${ACCOUNT_ID}" --budget-name "${BUDGET_NAME}" >/dev/null 2>&1 ||
  fail "The budget alarm is missing. Nothing else was created."
echo "The budget alarm exists."

say "3 to 6. The pipeline's identities, their outer limits, and the state bucket"
terraform apply -input=false -auto-approve

TOPIC_ARN="$(terraform output -raw alarm_topic_arn)"

say "The address for alarm emails"
SUBSCRIPTIONS="$(aws sns list-subscriptions-by-topic --region "${REGION}" --topic-arn "${TOPIC_ARN}" \
  --query 'Subscriptions[?Protocol==`email`].SubscriptionArn' --output text)"
if [ -z "${SUBSCRIPTIONS}" ]; then
  # Typed here and stored in the subscription only: not in the repository,
  # not in Terraform's state, not printed.
  read -r -p "Address that alarm emails should go to: " ALARM_ADDRESS
  [ -n "${ALARM_ADDRESS}" ] || fail "No address was given."
  aws sns subscribe --region "${REGION}" --topic-arn "${TOPIC_ARN}" \
    --protocol email --notification-endpoint "${ALARM_ADDRESS}" >/dev/null
  unset ALARM_ADDRESS
  echo "A confirmation message was sent. Open it and confirm the subscription."
elif printf '%s' "${SUBSCRIPTIONS}" | grep -q "PendingConfirmation"; then
  echo "WARNING: the email subscription is still unconfirmed. Until it is confirmed, alarms fire and nobody is told."
else
  echo "The email subscription is confirmed."
fi

say "Counting the budget by the tag \"project\""
if aws ce update-cost-allocation-tags-status \
  --cost-allocation-tags-status TagKey=project,Status=Active >/dev/null 2>&1; then
  echo "The tag is switched on for cost reporting. AWS can take up to a day to start counting by it."
else
  echo "NOTE: the tag \"project\" could not be switched on yet. AWS lists a tag only after a resource has carried it for some hours."
  echo "      Run this script again after the first deployment; until then the budget shows nothing."
fi

if [ "${STATE_IN_BUCKET}" -eq 0 ]; then
  say "7. Moving the setup's own state into the bucket"
  write_backend_file
  terraform init -input=false -migrate-state -force-copy "${backend_arguments[@]}"
  aws s3api head-object --bucket "${STATE_BUCKET}" --key "${STATE_KEY}" >/dev/null 2>&1 ||
    fail "The state did not arrive in the bucket. The copy on this machine was kept; run this script again."
  rm -f terraform.tfstate terraform.tfstate.backup
  echo "The state is in the bucket; the local copy was removed."
fi

say "Done"
echo "Next: infra/setup/github-settings.sh applies GitHub's settings."
