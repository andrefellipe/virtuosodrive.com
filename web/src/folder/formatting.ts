/**
 * How a row's size and kind are shown (rules BR3.2, BR3.3). Pure functions;
 * the icon files themselves are in icons.ts.
 */

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

/**
 * A file's size as text: "0 B" for an empty file; whole bytes under 1024;
 * then kB, MB or GB with two decimal places, as the old site wrote them. A
 * folder shows no size.
 */
export function formatSize(row: { kind: "folder" | "file"; size?: number }) {
  if (row.kind === "folder" || row.size === undefined) {
    return "";
  }
  const size = row.size;
  if (size === 0) {
    return "0 B";
  }
  if (size < KB) {
    return `${size} bytes`;
  }
  if (size < MB) {
    return `${(size / KB).toFixed(2)} kB`;
  }
  if (size < GB) {
    return `${(size / MB).toFixed(2)} MB`;
  }
  return `${(size / GB).toFixed(2)} GB`;
}

export type IconKind =
  | "folder"
  | "txt"
  | "image"
  | "pdf"
  | "audio"
  | "video"
  | "word"
  | "excel"
  | "powerpoint"
  | "zip"
  | "default";

export interface RowIcon {
  icon: IconKind;
  /** The text alternative, which names the kind. */
  label: string;
}

const LABELS: Record<IconKind, string> = {
  folder: "Folder",
  txt: "Text file",
  image: "Image",
  pdf: "PDF file",
  audio: "Audio file",
  video: "Video file",
  word: "Word document",
  excel: "Excel spreadsheet",
  powerpoint: "PowerPoint presentation",
  zip: "Compressed file",
  default: "File",
};

/** The content types the old page listed for each icon, kept as they were. */
const BY_TYPE: Record<string, IconKind> = {
  "text/plain": "txt",
  "image/jpeg": "image",
  "image/jpg": "image",
  "image/png": "image",
  "image/gif": "image",
  "application/pdf": "pdf",
  "application/msword": "word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.template":
    "word",
  "application/vnd.ms-word.document.macroEnabled.12": "word",
  "application/vnd.ms-word.template.macroEnabled.12": "word",
  "application/vnd.ms-excel": "excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template":
    "excel",
  "application/vnd.ms-excel.sheet.macroEnabled.12": "excel",
  "application/vnd.ms-excel.template.macroEnabled.12": "excel",
  "application/vnd.ms-excel.addin.macroEnabled.12": "excel",
  "application/vnd.ms-excel.sheet.binary.macroEnabled.12": "excel",
  "application/vnd.ms-powerpoint": "powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.template":
    "powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow":
    "powerpoint",
  "application/vnd.ms-powerpoint.addin.macroEnabled.12": "powerpoint",
  "application/vnd.ms-powerpoint.presentation.macroEnabled.12": "powerpoint",
  "application/vnd.ms-powerpoint.template.macroEnabled.12": "powerpoint",
  "application/vnd.ms-powerpoint.slideshow.macroEnabled.12": "powerpoint",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "multipart/x-zip": "zip",
  "application/x-rar-compressed": "zip",
};

function iconKind(row: {
  kind: "folder" | "file";
  contentType?: string;
}): IconKind {
  if (row.kind === "folder") {
    return "folder";
  }
  const type = row.contentType;
  if (type === undefined) {
    return "default";
  }
  // Two deliberate differences from the old page: any video type shows the
  // video icon, and "application/octet-stream", which only means "unknown",
  // shows the default icon (it is in no list here).
  if (type.startsWith("audio/")) {
    return "audio";
  }
  if (type.startsWith("video/")) {
    return "video";
  }
  return BY_TYPE[type] ?? "default";
}

/** The icon for a row, chosen from its kind and content type, with its text alternative. */
export function iconFor(row: {
  kind: "folder" | "file";
  contentType?: string;
}): RowIcon {
  const icon = iconKind(row);
  return { icon, label: LABELS[icon] };
}

/** "1 item", "3 items". */
export function countOfItems(count: number): string {
  return count === 1 ? "1 item" : `${count} items`;
}
