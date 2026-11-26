import { gzipSync } from "node:zlib";

/** At most 300 kilobytes, compressed, for everything the page loads at first (performance design P4). */
export const PAGE_BUDGET_BYTES = 300 * 1024;

export interface BuiltFile {
  name: string;
  content: Uint8Array;
}

export interface PageSize {
  totalCompressedBytes: number;
  files: { name: string; compressedBytes: number }[];
  withinBudget: boolean;
}

/**
 * The compressed size of the page's built files. Every file of the build is
 * counted, which is at least what the first load fetches, so the figure can
 * only err on the strict side.
 */
export function measurePage(
  files: readonly BuiltFile[],
  budgetBytes: number = PAGE_BUDGET_BYTES,
): PageSize {
  const measured = files.map((file) => ({
    name: file.name,
    compressedBytes: gzipSync(file.content).byteLength,
  }));
  const totalCompressedBytes = measured.reduce(
    (sum, file) => sum + file.compressedBytes,
    0,
  );
  return {
    totalCompressedBytes,
    files: measured,
    withinBudget: files.length > 0 && totalCompressedBytes <= budgetBytes,
  };
}
