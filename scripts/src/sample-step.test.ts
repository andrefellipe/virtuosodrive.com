import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT } from "./files.ts";
import {
  DEPLOY_ACTION_FILE,
  findSampleStepProblems,
} from "./repository-rules.ts";

const step = (name: string, lines: string[] = []): string =>
  [
    `    - name: ${name}`,
    "      shell: bash",
    ...lines,
    "      run: echo",
  ].join("\n");

const CONDITION = "      if: inputs.environment == 'test'";
const INSTRUCTION = `        --payload '{"mode":"load-samples"}'`;

function action(steps: string[]): { path: string; content: string }[] {
  return [
    {
      path: DEPLOY_ACTION_FILE,
      content: ["runs:", "  using: composite", "  steps:", ...steps].join("\n"),
    },
  ];
}

const SOUND = [
  step("Database changes"),
  step("Sample content", [CONDITION, INSTRUCTION]),
  step('"Switch: the server, then the page"'),
];

const problems = (steps: string[]): string[] =>
  findSampleStepProblems(action(steps)).map((finding) => finding.detail);

/** The second fence that keeps sample content out of production (security design S31). */
describe("the check of the deploy action's sample content step", () => {
  it("finds nothing wrong when the step exists, runs only in test, and sits between the database changes and the switch", () => {
    expect(findSampleStepProblems(action(SOUND))).toEqual([]);
  });

  it("finds nothing wrong in the repository's own deploy action", () => {
    const content = readFileSync(join(ROOT, DEPLOY_ACTION_FILE), "utf8");

    expect(
      findSampleStepProblems([{ path: DEPLOY_ACTION_FILE, content }]),
    ).toEqual([]);
  });

  it("fails when the step has lost its condition", () => {
    expect(
      problems([
        step("Database changes"),
        step("Sample content", [INSTRUCTION]),
        step("Switch"),
      ]),
    ).toEqual([
      expect.stringContaining("must run only when the environment is test"),
    ]);
  });

  it.each([
    ["always", "      if: always()"],
    ["production", "      if: inputs.environment == 'production'"],
    [
      "test or anything else",
      "      if: inputs.environment == 'test' || inputs.environment != ''",
    ],
    ["not production", "      if: inputs.environment != 'production'"],
  ])("fails when the condition is %s", (_what, condition) => {
    expect(
      problems([
        step("Database changes"),
        step("Sample content", [condition, INSTRUCTION]),
        step("Switch"),
      ]),
    ).toHaveLength(1);
  });

  it("fails when the step has two conditions", () => {
    expect(
      problems([
        step("Database changes"),
        step("Sample content", [CONDITION, "      if: always()", INSTRUCTION]),
        step("Switch"),
      ]),
    ).toHaveLength(1);
  });

  it("fails when there is no such step, or no deploy action", () => {
    expect(problems([step("Database changes"), step("Switch")])).toEqual([
      'there is no step named "Sample content"',
    ]);
    expect(findSampleStepProblems([])).toEqual([
      {
        rule: "sample-content-step",
        path: DEPLOY_ACTION_FILE,
        detail: "the deploy action is missing",
      },
    ]);
  });

  it("fails when the step does not give the instruction to load samples", () => {
    expect(
      problems([
        step("Database changes"),
        step("Sample content", [CONDITION]),
        step("Switch"),
      ]),
    ).toEqual([expect.stringContaining("does not give the instruction")]);
  });

  it("fails when the step comes before the database changes or after the switch", () => {
    const sample = step("Sample content", [CONDITION, INSTRUCTION]);

    for (const order of [
      [sample, step("Database changes"), step("Switch")],
      [step("Database changes"), step("Switch"), sample],
    ]) {
      expect(problems(order)).toEqual([
        expect.stringContaining(
          "after the database changes and before the switch",
        ),
      ]);
    }
  });

  it("fails when another step, without the condition, gives the instruction too", () => {
    expect(
      problems([
        step("Database changes", [INSTRUCTION]),
        step("Sample content", [CONDITION, INSTRUCTION]),
        step("Switch"),
      ]),
    ).toEqual([expect.stringContaining('"Database changes" gives it too')]);
  });
});
