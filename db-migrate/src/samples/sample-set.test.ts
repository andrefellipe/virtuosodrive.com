import { describe, expect, it } from "vitest";
import { checkNameForm, NAME_LIMIT } from "../../../server/src/drive/names.ts";
import {
  allNodes,
  expandSampleSet,
  SAMPLE_KEY_PREFIX,
  SAMPLE_LIMIT,
  SAMPLE_SET,
  sampleSetProblems,
} from "./sample-set.ts";
import type { SampleNode } from "./sample-set.ts";

const all = allNodes(SAMPLE_SET);
const byKey = (key: string): SampleNode => {
  const node = all.find((candidate) => candidate.sourceKey === `sample:${key}`);
  if (node === undefined) {
    throw new Error(`The sample set has no entry "${key}"`);
  }
  return node;
};
/** How many folders deep the deepest entry sits below "All". */
const depth = (nodes: readonly SampleNode[]): number =>
  nodes.length === 0
    ? 0
    : 1 + Math.max(...nodes.map((node) => depth(node.children)));

describe("the sample set kept in the repository", () => {
  it("is valid by the name rules and holds at most 1,000 items, none with contents", () => {
    expect(sampleSetProblems(SAMPLE_SET)).toEqual([]);
    expect(SAMPLE_LIMIT).toBe(1_000);
    expect(all.length).toBeLessThanOrEqual(SAMPLE_LIMIT);
    expect(all.length).toBeGreaterThan(500);
    for (const node of all) {
      expect(node).not.toHaveProperty("contentId");
    }
  });

  it("gives every entry a source key of its own, starting sample:, made of keys and never of names", () => {
    const keys = all.map((node) => node.sourceKey);

    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(key).toMatch(/^sample:[a-z0-9-]+(\/[a-z0-9-]+)*$/);
    }
    expect(SAMPLE_KEY_PREFIX).toBe("sample:");
  });

  it("lists parents before their children", () => {
    const seen = new Set<string>();
    for (const node of all) {
      const parent = node.sourceKey.slice(0, node.sourceKey.lastIndexOf("/"));
      if (node.sourceKey.includes("/")) {
        expect(seen.has(parent)).toBe(true);
      }
      seen.add(node.sourceKey);
    }
  });

  it('has folders nested at least four deep, with a folder named "2019.1" and one named "1º Período"', () => {
    expect(byKey("periodo-1").name).toBe("1º Período");
    expect(byKey("periodo-1/calculo-1/2019-1").name).toBe("2019.1");
    expect(byKey("periodo-1/calculo-1/2019-1/provas").kind).toBe("folder");
    expect(byKey("periodo-1/calculo-1/2019-1/provas/p1").kind).toBe("file");
  });

  it("has a folder of 20 items, one of 500, and an empty one", () => {
    expect(byKey("twenty").children).toHaveLength(20);
    expect(byKey("five-hundred").children).toHaveLength(500);
    expect(byKey("five-hundred").children[0]?.name).toBe(
      "Lecture notes 001.pdf",
    );
    expect(byKey("five-hundred").children.at(-1)?.name).toBe(
      "Lecture notes 500.pdf",
    );
    expect(byKey("empty")).toMatchObject({ kind: "folder", children: [] });
  });

  it("has one file of each icon kind, a video included, one of an unknown type, one with no type and one of zero bytes", () => {
    const types = byKey("kinds").children.map((node) => node.contentType);

    for (const expected of [
      "text/plain",
      "image/jpeg",
      "application/pdf",
      "audio/mpeg",
      "video/mp4",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/zip",
      "application/octet-stream",
    ]) {
      expect(types).toContain(expected);
    }
    expect(byKey("kinds/folder").kind).toBe("folder");
    expect(byKey("kinds/no-type")).not.toHaveProperty("contentType");
    expect(byKey("kinds/zero-bytes").size).toBe(0);
  });

  it("has the three names that look like markup, each valid under the name rules", () => {
    expect(byKey("names/markup-bold").name).toBe("<b>x<b>");
    expect(byKey("names/markup-script").name).toBe("<script>alert(1)<script>");
    expect(byKey("names/markup-image").name).toBe(
      "<img src=x onerror=alert(1)>",
    );
  });

  it("has a name with an accent sent as two characters, which the name rules store as one", () => {
    const sent = byKey("names/accent-as-two-characters").name;

    expect(sent).toBe(`Resume${String.fromCodePoint(0x301)}.txt`);
    expect(checkNameForm(sent)).toEqual({
      ok: true,
      name: `Resum${String.fromCodePoint(0xe9)}.txt`,
    });
  });

  it("has a name of exactly 255 characters and a path twelve folders deep", () => {
    const longest = byKey("names/longest-name").name;

    expect(Array.from(longest)).toHaveLength(NAME_LIMIT);
    expect(longest.endsWith(".pdf")).toBe(true);
    expect(depth(SAMPLE_SET)).toBeGreaterThanOrEqual(12);
    expect(
      byKey(
        Array.from(
          { length: 12 },
          (_unused, index) => `level-${String(index + 1).padStart(2, "0")}`,
        ).join("/"),
      ).name,
    ).toBe("Level 12 of twelve");
  });

  it("has one deleted file, and one deleted folder holding a file and a folder that carry no mark of their own", () => {
    expect(byKey("deleted-things/deleted-file")).toMatchObject({
      kind: "file",
      deleted: true,
    });
    const folder = byKey("deleted-things/deleted-folder");
    expect(folder).toMatchObject({ kind: "folder", deleted: true });
    expect(folder.children.map((node) => [node.kind, node.deleted])).toEqual([
      ["file", false],
      ["folder", false],
    ]);
    expect(byKey("deleted-things/still-here").deleted).toBe(false);
    expect(all.filter((node) => node.deleted)).toHaveLength(2);
  });

  it("holds no email-shaped text and no name of a real person or file of the old site", () => {
    expect(JSON.stringify(SAMPLE_SET)).not.toMatch(/@[a-z0-9-]+\./i);
  });
});

describe("reading a sample set from its data", () => {
  const folder = (key: string, children: unknown[] = []) => ({
    key,
    kind: "folder",
    name: key,
    children,
  });
  const file = (key: string) => ({ key, kind: "file", name: key, size: 1 });

  it("numbers repeated entries with leading zeros and nests chained ones", () => {
    const nodes = expandSampleSet({
      entries: [
        { ...file("f"), name: "F {n}.txt", repeat: 10 },
        { ...folder("d", [file("leaf")]), name: "D{n}", chain: 2 },
      ],
    });

    expect(nodes.map((node) => node.sourceKey)).toEqual([
      ...Array.from(
        { length: 10 },
        (_unused, index) => `sample:f-${String(index + 1).padStart(2, "0")}`,
      ),
      "sample:d-1",
    ]);
    expect(nodes[9]?.name).toBe("F 10.txt");
    expect(nodes[10]).toMatchObject({
      name: "D1",
      children: [
        {
          sourceKey: "sample:d-1/d-2",
          name: "D2",
          children: [{ sourceKey: "sample:d-1/d-2/leaf" }],
        },
      ],
    });
  });

  it("names the entry when the data is malformed", () => {
    const refused = (entries: unknown[]) => () => expandSampleSet({ entries });

    expect(() => expandSampleSet({})).toThrow('no "entries" list');
    expect(refused([{ ...file("a"), key: "Not A Key" }])).toThrow("a key is");
    expect(refused([{ ...file("a"), size: undefined }])).toThrow(
      '"entries/a": a file needs a size',
    );
    expect(refused([{ ...file("a"), children: [] }])).toThrow("holds nothing");
    expect(refused([{ ...folder("a"), size: 1 }])).toThrow("no size");
    expect(refused([{ ...folder("a"), children: undefined }])).toThrow(
      "list of children",
    );
    expect(refused([{ ...file("a"), kind: "link" }])).toThrow("kind must be");
    expect(refused([{ ...file("a"), contents: "x" }])).toThrow(
      'unknown field "contents"',
    );
    expect(refused([{ ...file("a"), repeat: 0 }])).toThrow("whole number");
    expect(refused([{ ...file("a"), repeat: 2 }])).toThrow("{n}");
    expect(refused([file("a"), file("a")])).toThrow("used twice");
    expect(refused([folder("a", [file("b"), file("b")])])).toThrow(
      '"sample:a/b": the key is used twice',
    );
    expect(refused([{ ...file("a"), padNameTo: 1 }])).toThrow("already has");
  });

  it("reports names the name rules refuse, by key, and a set that is too large", () => {
    const nodes = expandSampleSet({
      entries: [
        { ...file("slash"), name: "a/b" },
        { ...file("many"), name: "x {n}", repeat: 1_001 },
      ],
    });

    expect(sampleSetProblems(nodes)).toEqual([
      "the set holds 1002 items; at most 1000 are allowed",
      "sample:slash: nameHasForbiddenCharacter",
    ]);
  });
});
