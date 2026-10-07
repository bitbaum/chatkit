/**
 * @bitbaum/chatkit/attach — picking files, for any screen, not only a chat.
 *
 *   import { AttachMenu, ATTACH_SOURCE_INPUT, shrinkImage } from "@bitbaum/chatkit/attach";
 *
 * An avatar uploader, a product-photo grid and a chat composer all need the
 * same thing from a phone: Camera, Photos and Files as separate choices, never
 * one input with a mixed `accept` (see ATTACH_SOURCE_INPUT). This entry point
 * carries exactly that, without the composer, so an app that has no chat does
 * not re-roll a file input — the copy is what drifts. CI enforces it:
 * `chatkit-check-file-inputs`.
 */
export { AttachMenu, DEFAULT_ATTACH_MENU_LABELS } from "./AttachMenu.js";
export type { AttachMenuLabels } from "./AttachMenu.js";
export {
  ATTACH_SOURCE_INPUT,
  acceptFamilies,
  isImageMime,
  isTextFile,
  type AcceptFamily,
  type AttachSource,
} from "../attachments.js";
export { shrinkImage } from "../image.js";
