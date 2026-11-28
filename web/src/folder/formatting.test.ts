import { describe, expect, it } from "vitest";
import { countOfItems, formatSize, iconFor } from "./formatting.ts";
import type { IconKind } from "./formatting.ts";

const file = (size: number) => ({ kind: "file" as const, size });
const KB = 1024;
const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

describe("the size of a row as text (rules BR3.3)", () => {
  it('shows "0 B" for an empty file', () => {
    expect(formatSize(file(0))).toBe("0 B");
  });

  it("shows whole bytes under 1024", () => {
    expect(formatSize(file(1))).toBe("1 bytes");
    expect(formatSize(file(512))).toBe("512 bytes");
    expect(formatSize(file(KB - 1))).toBe("1023 bytes");
  });

  it("shows kB from 1024 bytes, with two decimal places", () => {
    expect(formatSize(file(KB))).toBe("1.00 kB");
    expect(formatSize(file(1536))).toBe("1.50 kB");
    expect(formatSize(file(MB - 1))).toBe("1024.00 kB");
  });

  it("shows MB from 1024 kB", () => {
    expect(formatSize(file(MB))).toBe("1.00 MB");
    expect(formatSize(file(5.5 * MB))).toBe("5.50 MB");
    expect(formatSize(file(GB - 1))).toBe("1024.00 MB");
  });

  it("shows GB from 1024 MB, and beyond", () => {
    expect(formatSize(file(GB))).toBe("1.00 GB");
    expect(formatSize(file(1.5 * GB))).toBe("1.50 GB");
    expect(formatSize(file(2048 * GB))).toBe("2048.00 GB");
  });

  it("shows nothing for a folder, and nothing for a file whose size is unknown", () => {
    expect(formatSize({ kind: "folder" })).toBe("");
    expect(formatSize({ kind: "folder", size: 10 })).toBe("");
    expect(formatSize({ kind: "file" })).toBe("");
  });
});

describe("the icon of a row (rules BR3.2; the design's table of icons)", () => {
  const cases: [string | undefined, IconKind, string][] = [
    ["text/plain", "txt", "Text file"],
    ["image/jpeg", "image", "Image"],
    ["image/jpg", "image", "Image"],
    ["image/png", "image", "Image"],
    ["image/gif", "image", "Image"],
    ["application/pdf", "pdf", "PDF file"],
    ["audio/mp3", "audio", "Audio file"],
    ["audio/ogg", "audio", "Audio file"],
    ["audio/mpeg", "audio", "Audio file"],
    ["video/mp4", "video", "Video file"],
    ["video/quicktime", "video", "Video file"],
    ["video/x-msvideo", "video", "Video file"],
    ["application/msword", "word", "Word document"],
    [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "word",
      "Word document",
    ],
    [
      "application/vnd.ms-word.template.macroEnabled.12",
      "word",
      "Word document",
    ],
    ["application/vnd.ms-excel", "excel", "Excel spreadsheet"],
    [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "excel",
      "Excel spreadsheet",
    ],
    [
      "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
      "excel",
      "Excel spreadsheet",
    ],
    ["application/vnd.ms-powerpoint", "powerpoint", "PowerPoint presentation"],
    [
      "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
      "powerpoint",
      "PowerPoint presentation",
    ],
    ["application/zip", "zip", "Compressed file"],
    ["application/x-zip-compressed", "zip", "Compressed file"],
    ["multipart/x-zip", "zip", "Compressed file"],
    ["application/x-rar-compressed", "zip", "Compressed file"],
    // "Unknown" is not "compressed": the default icon, unlike the old page.
    ["application/octet-stream", "default", "File"],
    ["application/x-something-new", "default", "File"],
    ["image/svg+xml", "default", "File"],
    ["", "default", "File"],
    [undefined, "default", "File"],
  ];

  it.each(cases)("for the content type %s", (contentType, icon, label) => {
    expect(
      iconFor({
        kind: "file",
        ...(contentType === undefined ? {} : { contentType }),
      }),
    ).toEqual({ icon, label });
  });

  it("is the folder icon for a folder, whatever else the row carries", () => {
    expect(iconFor({ kind: "folder" })).toEqual({
      icon: "folder",
      label: "Folder",
    });
    expect(iconFor({ kind: "folder", contentType: "application/pdf" })).toEqual(
      { icon: "folder", label: "Folder" },
    );
  });
});

describe("a count of items as text", () => {
  it("says item for one and items otherwise", () => {
    expect(countOfItems(0)).toBe("0 items");
    expect(countOfItems(1)).toBe("1 item");
    expect(countOfItems(500)).toBe("500 items");
  });
});
