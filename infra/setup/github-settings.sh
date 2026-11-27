#!/usr/bin/env bash
# GitHub's settings for the pipeline (infrastructure specification, "Account-wide
# resources"). Run by the maintainer after setup.sh, signed in to GitHub with
# the gh command line and to AWS:
#
#   infra/setup/github-settings.sh
#
# It applies: the pipeline's two identities, the state bucket's name and the
# alarm topic's name as repository secrets (they contain the AWS account's
# number, and workflow logs are public), removing the variables that held
# them before; the Region as a repository variable;
# "aws-migration" as the default branch (GitHub runs manually started and
# scheduled workflows only from the default branch; "master" itself is not
# changed); squash as the only way to merge; the "production" environment,
# with the maintainer as required reviewer and restricted to that branch; and
# protection of the branch. Run again, it applies the same settings.

set -euo pipefail
cd "$(dirname "$0")"

REPOSITORY="andrefellipe/virtuosodrive.com"
BRANCH="aws-migration"
# The names of the jobs in .github/workflows/checks.yml that must pass.
REQUIRED_CHECKS='["code","infrastructure","description"]'

say() { printf '\n== %s\n' "$1"; }
fail() {
  printf '\nStopped: %s\n' "$1" >&2
  exit 1
}

command -v gh >/dev/null || fail "The GitHub command line (gh) is not installed."
command -v terraform >/dev/null || fail "Terraform is not installed."
gh auth status >/dev/null 2>&1 || fail "You are not signed in to GitHub (gh auth login)."

say "Repository secrets and the Region"
# The four names below contain the AWS account's number. They are stored as
# secrets, not variables, so that GitHub replaces them by *** in workflow
# logs, which are public. Each value goes from Terraform to gh on standard
# input: it is never shown here and never part of a command line.
role_arn() {
  terraform output -json deploy_role_arns |
    python3 -c 'import json,sys; sys.stdout.write(json.load(sys.stdin)[sys.argv[1]])' "$1"
}
role_arn test | gh secret set AWS_ROLE_TEST --repo "${REPOSITORY}"
role_arn production | gh secret set AWS_ROLE_PRODUCTION --repo "${REPOSITORY}"
terraform output -raw state_bucket | gh secret set TF_STATE_BUCKET --repo "${REPOSITORY}"
terraform output -raw alarm_topic_arn | gh secret set ALARM_TOPIC_ARN --repo "${REPOSITORY}"
# The Region is not secret and stays a variable.
gh variable set AWS_REGION --repo "${REPOSITORY}" --body "$(terraform output -raw region)"

say "Variables that used to hold those four names"
# Removed only after the secrets above exist, so the pipeline always finds one
# or the other. A variable that is already gone is left as it is.
EXISTING_VARIABLES="$(gh variable list --repo "${REPOSITORY}" --json name --jq '.[].name')"
for NAME in AWS_ROLE_TEST AWS_ROLE_PRODUCTION TF_STATE_BUCKET ALARM_TOPIC_ARN; do
  if grep -qx "${NAME}" <<<"${EXISTING_VARIABLES}"; then
    gh variable delete "${NAME}" --repo "${REPOSITORY}"
    echo "Removed the variable ${NAME}."
  else
    echo "The variable ${NAME} is not there; nothing to remove."
  fi
done

say "Default branch and merging by squash only"
gh api --method PATCH "repos/${REPOSITORY}" \
  -f default_branch="${BRANCH}" \
  -F allow_squash_merge=true \
  -F allow_merge_commit=false \
  -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true >/dev/null

say "The production environment"
REVIEWER_ID="$(gh api user --jq .id)"
gh api --method PUT "repos/${REPOSITORY}/environments/production" --input - >/dev/null <<EOF ||
{
  "reviewers": [{ "type": "User", "id": ${REVIEWER_ID} }],
  "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true }
}
EOF
  fail "The production environment could not be given a required reviewer. GitHub's plan for this repository may not allow it; production approval then needs another mechanism."
if ! gh api "repos/${REPOSITORY}/environments/production/deployment-branch-policies" --jq '.branch_policies[].name' | grep -qx "${BRANCH}"; then
  gh api --method POST "repos/${REPOSITORY}/environments/production/deployment-branch-policies" \
    -f name="${BRANCH}" -f type=branch >/dev/null
fi

say "Protection of ${BRANCH}"
gh api --method PUT "repos/${REPOSITORY}/branches/${BRANCH}/protection" --input - >/dev/null <<EOF ||
{
  "required_status_checks": { "strict": true, "contexts": ${REQUIRED_CHECKS} },
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
  fail "The branch could not be protected. GitHub's plan for this repository may not allow it; nothing else can enforce that changes arrive only through checked pull requests."

say "Done"
echo "Merging the first pull request into ${BRANCH} now builds both environments."
