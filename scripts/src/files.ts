import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { BuiltFile } from "./page-size.ts";

/** The repository's root folder. */
export const ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** Every file under a folder, with its content, named relative to that folder. */
export function readFolder(folder: string): BuiltFile[] {
  const files: BuiltFile[] = [];
  const visit = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const path = join(current, entry);
      if (statSync(path).isDirectory()) {
        visit(path);
      } else {
        files.push({
          name: relative(folder, path),
          content: readFileSync(path),
        });
      }
    }
  };
  visit(folder);
  return files;
}
