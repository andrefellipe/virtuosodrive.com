import audio from "../assets/icons/audio.svg";
import check from "../assets/icons/check.svg";
import defaultIcon from "../assets/icons/default.svg";
import download from "../assets/icons/download.svg";
import excel from "../assets/icons/excel.svg";
import folderPlus from "../assets/icons/folder-plus.svg";
import folder from "../assets/icons/folder.svg";
import image from "../assets/icons/image.svg";
import pdf from "../assets/icons/pdf.svg";
import powerpoint from "../assets/icons/powerpoint.svg";
import rename from "../assets/icons/rename.svg";
import trash from "../assets/icons/trash.svg";
import txt from "../assets/icons/txt.svg";
import upload from "../assets/icons/upload.svg";
import video from "../assets/icons/video.svg";
import word from "../assets/icons/word.svg";
import zip from "../assets/icons/zip.svg";
import type { IconKind } from "./formatting.ts";

/**
 * The icon files (decision T30): the old site's own, copied unchanged from
 * app/public/images/icons/, and one new check mark. They are imported as
 * files, so the build gives each a fingerprinted name and none is embedded
 * in the script (performance design P25).
 */

/** The icon for each kind of row. */
export const KIND_ICONS: Record<IconKind, string> = {
  folder,
  txt,
  image,
  pdf,
  audio,
  video,
  word,
  excel,
  powerpoint,
  zip,
  default: defaultIcon,
};

/** The icons of the actions, beside each action's visible text. */
export const ACTION_ICONS = {
  upload,
  newFolder: folderPlus,
  download,
  rename,
  delete: trash,
} as const;

/** The check mark at the start of a selected row. */
export const CHECK_ICON: string = check;
