import { checkNameForm, splitName } from "../../../server/src/drive/names.ts";
import data from "./sample-set.json" with { type: "json" };

/**
 * The prepared sample content (design W6; decision T29): a data file beside
 * this one, read into a tree here. This module only reads and checks the
 * data; loading it into the database is loader.ts.
 */

/** Every sample item's source key starts with this (entities: sourceKey). */
export const SAMPLE_KEY_PREFIX = "sample:";

/** The most items the sample set may hold (scalability design C22). */
export const SAMPLE_LIMIT = 1_000;

/** One sample entry, ready to load. */
export interface SampleNode {
  /** "sample:" and the keys from the top down to this entry, joined by "/". */
  sourceKey: string;
  kind: "folder" | "file";
  /** As a person might send it: the loader's change step normalises it. */
  name: string;
  /** A file's size in whole bytes. */
  size?: number;
  contentType?: string;
  /** Created and then marked deleted. */
  deleted: boolean;
  /** What a folder holds, in order. Empty for a file. */
  children: SampleNode[];
}

interface RawEntry {
  key: string;
  kind: "folder" | "file";
  name: string;
  size?: number;
  contentType?: string;
  deleted?: boolean;
  /** Makes this many entries beside each other, numbered from 1. */
  repeat?: number;
  /** Makes this many folders one inside the other; the last holds the children. */
  chain?: number;
  /** Lengthens the name, before its extension, to exactly this many characters. */
  padNameTo?: number;
  children?: RawEntry[];
}

const KEY_FORM = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CODE_POINT = /\{U\+([0-9A-F]{4,6})\}/g;
const ALLOWED_FIELDS = new Set([
  "key",
  "kind",
  "name",
  "size",
  "contentType",
  "deleted",
  "repeat",
  "chain",
  "padNameTo",
  "children",
]);

function fail(where: string, what: string): never {
  throw new Error(`The sample set is malformed at "${where}": ${what}`);
}

function wholeNumber(value: unknown, least: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= least;
}

function checkEntry(value: unknown, where: string): RawEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail(where, "an entry must be an object");
  }
  const entry = value as Record<string, unknown>;
  const key = entry.key;
  if (typeof key !== "string" || !KEY_FORM.test(key)) {
    return fail(where, "a key is lower-case letters, digits and dashes");
  }
  const here = `${where}/${key}`;
  for (const field of Object.keys(entry)) {
    if (!ALLOWED_FIELDS.has(field)) {
      fail(here, `unknown field "${field}"`);
    }
  }
  if (entry.kind !== "folder" && entry.kind !== "file") {
    fail(here, 'kind must be "folder" or "file"');
  }
  if (typeof entry.name !== "string" || entry.name === "") {
    fail(here, "a name is needed");
  }
  if (entry.kind === "file") {
    if (!wholeNumber(entry.size, 0)) {
      fail(here, "a file needs a size in whole bytes");
    }
    if (entry.children !== undefined || entry.chain !== undefined) {
      fail(here, "a file holds nothing");
    }
  } else {
    if (entry.size !== undefined || entry.contentType !== undefined) {
      fail(here, "a folder has no size and no content type");
    }
    if (!Array.isArray(entry.children)) {
      fail(here, "a folder needs its list of children, even an empty one");
    }
  }
  if (
    entry.contentType !== undefined &&
    typeof entry.contentType !== "string"
  ) {
    fail(here, "a content type is text");
  }
  if (entry.deleted !== undefined && typeof entry.deleted !== "boolean") {
    fail(here, "deleted is true or false");
  }
  for (const count of ["repeat", "chain", "padNameTo"] as const) {
    if (entry[count] !== undefined && !wholeNumber(entry[count], 1)) {
      fail(here, `${count} must be a whole number from 1`);
    }
  }
  if (entry.repeat !== undefined && entry.chain !== undefined) {
    fail(here, "an entry is repeated or chained, not both");
  }
  const numbered = entry.repeat !== undefined || entry.chain !== undefined;
  if (numbered !== (entry.name as string).includes("{n}")) {
    fail(
      here,
      "a name holds {n} exactly when the entry is repeated or chained",
    );
  }
  return entry as unknown as RawEntry;
}

/** Replaces {U+XXXX} by the character with that code point. */
function withCodePoints(name: string): string {
  return name.replace(CODE_POINT, (_whole, hex: string) =>
    String.fromCodePoint(Number.parseInt(hex, 16)),
  );
}

/** Lengthens a name, before its extension, to exactly the given number of code points. */
function paddedTo(name: string, length: number, where: string): string {
  const { base, extension } = splitName(name);
  const missing = length - Array.from(name).length;
  if (missing < 1) {
    return fail(where, `the name already has ${length} characters or more`);
  }
  const padding = ` ${"0123456789".repeat(Math.ceil(missing / 10))}`.slice(
    0,
    missing,
  );
  return `${base}${padding}${extension}`;
}

/** The source key of an entry inside the entry (or the top) with the given key. */
function childKey(parentKey: string, key: string): string {
  return parentKey === SAMPLE_KEY_PREFIX
    ? `${parentKey}${key}`
    : `${parentKey}/${key}`;
}

function nodeFrom(
  entry: RawEntry,
  key: string,
  name: string,
  parentKey: string,
  children: SampleNode[] | undefined,
): SampleNode {
  const sourceKey = childKey(parentKey, key);
  const withCharacters = withCodePoints(name);
  return {
    sourceKey,
    kind: entry.kind,
    name:
      entry.padNameTo === undefined
        ? withCharacters
        : paddedTo(withCharacters, entry.padNameTo, sourceKey),
    ...(entry.size === undefined ? {} : { size: entry.size }),
    ...(entry.contentType === undefined
      ? {}
      : { contentType: entry.contentType }),
    deleted: entry.deleted === true,
    children:
      children ?? expandEntries(entry.children ?? [], sourceKey, sourceKey),
  };
}

const numbered = (count: number, number: number): string =>
  String(number).padStart(String(count).length, "0");

function expandEntry(
  value: unknown,
  parentKey: string,
  where: string,
): SampleNode[] {
  const entry = checkEntry(value, where);
  if (entry.repeat !== undefined) {
    const count = entry.repeat;
    return Array.from({ length: count }, (_unused, index) => {
      const number = numbered(count, index + 1);
      return nodeFrom(
        entry,
        `${entry.key}-${number}`,
        entry.name.replaceAll("{n}", number),
        parentKey,
        undefined,
      );
    });
  }
  if (entry.chain !== undefined) {
    // Built from the innermost outwards, so that each holds the next.
    const count = entry.chain;
    const keys = Array.from(
      { length: count },
      (_unused, index) => `${entry.key}-${numbered(count, index + 1)}`,
    );
    // The source key of the folder that holds the one at each level.
    const holders = [parentKey];
    for (const key of keys) {
      holders.push(childKey(holders.at(-1) as string, key));
    }
    let inner: SampleNode[] | undefined;
    for (let level = count; level >= 1; level -= 1) {
      inner = [
        nodeFrom(
          entry,
          keys[level - 1] as string,
          entry.name.replaceAll("{n}", String(level)),
          holders[level - 1] as string,
          inner,
        ),
      ];
    }
    return inner ?? [];
  }
  return [nodeFrom(entry, entry.key, entry.name, parentKey, undefined)];
}

function expandEntries(
  entries: readonly unknown[],
  parentKey: string,
  where: string,
): SampleNode[] {
  const nodes = entries.flatMap((entry) =>
    expandEntry(entry, parentKey, where),
  );
  const keys = new Set<string>();
  for (const node of nodes) {
    if (keys.has(node.sourceKey)) {
      fail(node.sourceKey, "the key is used twice in one folder");
    }
    keys.add(node.sourceKey);
  }
  return nodes;
}

/**
 * Reads a sample set from its data, in the fixed order of the file, parents
 * before children. Throws, naming the entry by its key, when the data is not
 * of the expected shape.
 */
export function expandSampleSet(raw: unknown): SampleNode[] {
  const entries = (raw as { entries?: unknown } | null)?.entries;
  if (!Array.isArray(entries)) {
    throw new Error('The sample set is malformed: it has no "entries" list');
  }
  return expandEntries(entries, SAMPLE_KEY_PREFIX, "entries");
}

/** Every entry of a tree, parents before children, in the order they are loaded. */
export function allNodes(nodes: readonly SampleNode[]): SampleNode[] {
  return nodes.flatMap((node) => [node, ...allNodes(node.children)]);
}

/**
 * What is wrong with a sample set that is of the right shape: a name the
 * name rules refuse, or too many items. Empty when nothing is. Whether two
 * names in one folder are the same is the database's to say; the loader
 * fails at such an entry.
 */
export function sampleSetProblems(nodes: readonly SampleNode[]): string[] {
  const problems: string[] = [];
  const all = allNodes(nodes);
  if (all.length > SAMPLE_LIMIT) {
    problems.push(
      `the set holds ${all.length} items; at most ${SAMPLE_LIMIT} are allowed`,
    );
  }
  for (const node of all) {
    const form = checkNameForm(node.name);
    if (!form.ok) {
      problems.push(`${node.sourceKey}: ${form.problem}`);
    }
  }
  return problems;
}

/** The sample set kept in the repository. */
export const SAMPLE_SET: readonly SampleNode[] = expandSampleSet(data);
