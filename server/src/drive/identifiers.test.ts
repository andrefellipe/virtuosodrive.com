import { describe, expect, it } from "vitest";
import {
  isFolderIdentifier,
  isItemIdentifier,
  ROOT_FOLDER,
} from "./identifiers.ts";

const GENERATED = "3f2b8c1e-9a4d-4e6f-8b7a-0c1d2e3f4a5b";

describe("identifiers", () => {
  it("accepts root and the generated form as a folder identifier", () => {
    expect(ROOT_FOLDER).toBe("root");
    expect(isFolderIdentifier("root")).toBe(true);
    expect(isFolderIdentifier(GENERATED)).toBe(true);
  });

  it("accepts only the generated form as an item identifier: root names no item", () => {
    expect(isItemIdentifier(GENERATED)).toBe(true);
    expect(isItemIdentifier("root")).toBe(false);
  });

  it.each([
    ["an empty value", ""],
    ["markup", "<script>alert(1)</script>"],
    ["a path fragment", "../"],
    ["a query fragment", `${GENERATED}' OR '1'='1`],
    ["a value of 10,000 characters", "a".repeat(10_000)],
    ["the generated form in upper case", GENERATED.toUpperCase()],
    [
      "the generated form with one letter in upper case",
      `3F${GENERATED.slice(2)}`,
    ],
    ["the generated form without its dashes", GENERATED.replaceAll("-", "")],
    ["the generated form in braces", `{${GENERATED}}`],
    ["the generated form followed by a line break", `${GENERATED}\n`],
    ["a space before the generated form", ` ${GENERATED}`],
    ["Root with a capital", "Root"],
    ["root followed by a slash", "root/"],
  ])("refuses %s", (_what, text) => {
    expect(isFolderIdentifier(text)).toBe(false);
    expect(isItemIdentifier(text)).toBe(false);
  });

  it("refuses anything that is not text", () => {
    for (const value of [undefined, null, 7, {}, [GENERATED]]) {
      expect(isFolderIdentifier(value)).toBe(false);
      expect(isItemIdentifier(value)).toBe(false);
    }
  });
});
