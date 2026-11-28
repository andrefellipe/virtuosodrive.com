import { describe, expect, it } from "vitest";
import {
  holdsVersion,
  makeVersionTag,
  readVersionTag,
  VERSION_TAG_LIMIT,
} from "./version-tag.ts";

const FOLDER = "3f2b8c1e-9a4d-4e6f-8b7a-0c1d2e3f4a5b";
const OTHER_FOLDER = "0a1b2c3d-4e5f-4a6b-9c7d-8e9f0a1b2c3d";

describe("the version a caller holds", () => {
  it("is a quoted text made of the folder's identifier and its version number", () => {
    expect(makeVersionTag(FOLDER, 7)).toBe(`"${FOLDER}.7"`);
  });

  it("is read back as issued", () => {
    expect(readVersionTag(makeVersionTag(FOLDER, 7))).toEqual({
      folderId: FOLDER,
      version: 7,
    });
    expect(
      holdsVersion(makeVersionTag(FOLDER, 7), { folderId: FOLDER, version: 7 }),
    ).toBe(true);
  });

  it("is still recognised when something on the way marked it as weak", () => {
    const weak = `W/${makeVersionTag(FOLDER, 7)}`;

    expect(readVersionTag(weak)).toEqual({ folderId: FOLDER, version: 7 });
    expect(holdsVersion(weak, { folderId: FOLDER, version: 7 })).toBe(true);
  });

  it("does not match an earlier or a later version of the same folder", () => {
    const held = makeVersionTag(FOLDER, 7);

    expect(holdsVersion(held, { folderId: FOLDER, version: 8 })).toBe(false);
    expect(holdsVersion(held, { folderId: FOLDER, version: 6 })).toBe(false);
  });

  it("treats another folder's version as holding none", () => {
    expect(
      holdsVersion(makeVersionTag(OTHER_FOLDER, 7), {
        folderId: FOLDER,
        version: 7,
      }),
    ).toBe(false);
  });

  it("treats a missing header as holding none", () => {
    expect(readVersionTag(undefined)).toBeUndefined();
    expect(holdsVersion(undefined, { folderId: FOLDER, version: 1 })).toBe(
      false,
    );
  });

  it("does not read a header longer than 128 characters", () => {
    const issued = makeVersionTag(FOLDER, 7);
    const padded = `${issued}${" ".repeat(VERSION_TAG_LIMIT)}`;

    expect(VERSION_TAG_LIMIT).toBe(128);
    expect(readVersionTag(padded)).toBeUndefined();
    expect(readVersionTag("x".repeat(10_000))).toBeUndefined();
  });

  it("treats a list of several versions as holding none", () => {
    const list = `${makeVersionTag(FOLDER, 6)}, ${makeVersionTag(FOLDER, 7)}`;

    expect(readVersionTag(list)).toBeUndefined();
    expect(holdsVersion(list, { folderId: FOLDER, version: 7 })).toBe(false);
  });

  it.each([
    ["no quotes", `${FOLDER}.7`],
    ["the any-version sign", "*"],
    ["an empty value", ""],
    ["version zero", `"${FOLDER}.0"`],
    ["a version with a leading zero", `"${FOLDER}.07"`],
    ["a negative version", `"${FOLDER}.-7"`],
    ["a version that is not a number", `"${FOLDER}.seven"`],
    ["an over-long version number", `"${FOLDER}.12345678901"`],
    ["an identifier in upper case", `"${FOLDER.toUpperCase()}.7"`],
    ["root as the identifier", '"root.7"'],
    ["text after the closing quote", `"${FOLDER}.7" `],
    ["a weak marker in lower case", `w/"${FOLDER}.7"`],
    ["two weak markers", `W/W/"${FOLDER}.7"`],
  ])("treats a malformed value as holding none: %s", (_what, header) => {
    expect(readVersionTag(header)).toBeUndefined();
    expect(holdsVersion(header, { folderId: FOLDER, version: 7 })).toBe(false);
  });
});
