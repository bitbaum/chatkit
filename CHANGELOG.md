# Changelog

## 0.21.4 — Any product's source handle is a chip

- Citation handles were read only as `[F1]` and `[D1]`. A product that numbers its sources by its own letter showed the bare handle in the answer, with no chip, no link and no sources row: Solon's law answers (`[L1]`, every answer since the law chat shipped) and Substrata's web sources (`[W12]`), found 2026-10-31. A handle is now one or two capital letters and a number, the same pattern `speakableText` already dropped for Listen. Without a citation map, an answer is not grounded and `[A1]` is just words, so it is shown as written; in a grounded answer an unknown handle is still dropped.

## 0.21.3 — A bare reply array, with no fence, is still the replies

- `extractReplies` took the replies only from the fenced block the instruction asks for. A model that forgets the fence and ends its answer on the bare JSON array instead (`["Ask if notice was respected", "Consult a lawyer"]` as the last paragraph; Causius's answers in OrangeCat's companions home, 2026-10-30) showed that array as text in the bubble. A complete array of two to six short strings as the last paragraph is now read as the replies and taken out of the text, once the answer is complete; while streaming it is left alone, since it may still be growing, and an array inside an answer (data, code) is never touched.

## 0.21.1 — The footnote is a `div`, not a `p`

- `ChatScreen`'s `footnote` was wrapped in a `<p>`. A product that put a panel, a form or its own paragraph in it (Substrata's "Send evidence" and key panel) produced HTML a browser repairs while parsing, so React found a different tree in the browser than the server sent and threw hydration error #418 on every load of `/chat` (found 2026-10-27, reproduced in a development build: "In HTML, <p> cannot be a descendant of <p>"). The wrapper is now a `<div class="ck-screen-footnote">`; the class and its styles are unchanged, so a one-line footnote looks the same.

## 0.21.0 — `attach.readFile`: the app's own reading of a picked file

- The composer and `ChatApp` read images and text and refused every other file, so an app that reads PDFs (`@bitbaum/chatkit/pdf`) could not use the paperclip, paste, drop or `ChatAppHandle.send` for them without a bridge. `attach.readFile(file, { limits, notes, images, room, progress })` returns the attachments to stage (one file may become several), a note, or `undefined` to leave the file to chatkit.
- Files are read one at a time, so `images` and `room` count a file before it. `readAttachmentFiles` is the same for code outside the box.

## 0.20.1 — Files opens the file browser on Brave for Android too

- `ATTACH_SOURCE_INPUT.files` asks for documents (`FILES_ACCEPT`: PDF and text) instead of nothing. An empty `accept` means "anything"; Brave on Android answered it with Camera, Recorder and "Photos & Videos" and no file browser, so a PDF could not be picked at all (OrangeCat, 2026-10-27). `FILES_ACCEPT` is exported from `@bitbaum/chatkit/attach`.

## 0.20.0 — PDFs a person attaches

- `@bitbaum/chatkit/pdf`: `readPdf(file, { maxSheets, assetsUrl })` reads a PDF in the browser. A PDF with a text layer comes back as text with page markers; one without (slide images, scans) as pictures of its pages, four to a sheet. Found on OrangeCat 2026-10-27: a 17-slide investor deck with no text layer could not be shared with the Cat at all.
- `chatkit-copy-pdf-assets <dir>`: copies pdf.js's worker and decoders where the app serves static files. Without it, JPEG 2000 pages (macOS's compressed PDF export) draw blank.
- Pure helpers for tests and an app's own wording: `isPdfFile`, `isTextRich`, `joinPageTexts`, `planSheets`, `sheetName`.
- New dependency: `pdfjs-dist` (loaded only when a PDF is read).

## 0.19.0 — ChatApp: what the first four products could not do with it

From the adoption PRs' own lists (bitbaum/heidi#226, bitbaum/orangecat#1447,
bitbaum/solon#309, bitbaum/substrata#262). All additive; 0.18 props behave as
before.

- `ChatApp` takes a ref: `ChatAppHandle` — `send(text, attachments?, { newChat?, chips? })`, `fill(text, files?)`, `focus()`, `newChat()`, `openConversation(id)`. `send` reads `File`s like the paperclip and, if one cannot attach, sends nothing and fills the box with the reason instead.
- `initialMessage` (sent once, in a new chat, after the list loads; StrictMode-safe) and `deepLinkParam` (fills a new chat's box from `?q=` and takes it off the address; sent only with `deepLinkAutoSend`). The chat from before the reload is not reopened over either.
- Retry re-sends the failed turn's pictures and files, not only its words.
- A failure is per turn: throw `ChatTurnError(message, { kind })`; the bubble shows its message and keeps `ChatMessageData.failure`. Other errors still show the `failed` label, never their raw message, unless `failureMessage` maps them. `chatTurnFailure` is the rule, exported.
- `stopKeepsPartial` (default true) and, per turn, `turn.stopKeepsPartial(keep)`.
- `Starter` may be `{ text, label?, lang? }`, and every object starter takes `lang` (set on the button). `starterParts` exported.
- `historySlot` (under the chat list's search box) and `historyEmpty` (instead of "No chats yet").
- `Composer attachExtras` / `AttachMenu rows`: the product's rows under Camera · Photos · Files, one anatomy; with `attach: false` the sheet holds only them.
- `ChatMessageData.chips` on the person's message, from `chipsFor` (or `send(…, { chips })`), shown at once and kept with the message.
- `onTemporaryEnd(chatId)` when a temporary chat is left, the page is hidden or ChatApp unmounts; `turn.chatId` is the same id.
- `renderFooter(m, { isLatest, index })` in `ChatThread`; in ChatApp also `send` and `fill`.
- `thread.after`: content after the last turn, inside the thread.
- `Composer handleRef` (`ComposerHandle`: `setText`, `addFiles`, `focus`, `submit`), and `readAttachmentFile` — the one file reader the composer and `send` share.
- The live answer's Stop button is a 44px target (it was 36px).

Left to products, on purpose:

- Translated sets of ChatApp's own words (Solon): every label is a prop; a product owns its language files, and chatkit shipping five locales would be a second copy of each product's dictionary.
- Replies as `{ label, say }` (Heidi): chips whose label differs from their sentence are product UI; `renderFooter`'s `send` makes them one tap without changing the reply format every model is told to emit.
- The hidden server row for a temporary chat (OrangeCat): ChatApp says when the chat ends; what the product stored and how it deletes it stays the product's.
- Pinned chats, by-project lists, hands-free voice (Loki): not asked for by these four; still tracked in "Moving a product onto ChatApp".

## Earlier

- The scroll owner now handles DOM environments without `document.scrollingElement`; when a previously scrollable thread loses its scroll container, the stale listener is cleaned up safely instead of crashing. A browser regression fixture covers the transition after a prior owner was selected.
- `ChatApp` (`@bitbaum/chatkit/react`): the whole chat app — header, chat list (drawer on a phone, rail when wide), New chat, Temporary chat, titles, rename and delete, the open chat restored on reload, turns that keep running in the background, the queue, attachments on by default. Additive: `ChatScreen`, `Composer` and `ChatThread` are unchanged.
- `ConversationStore` with `localConversationStore` (device, versioned, never throws) and `httpConversationStore` (REST); `deriveTitle`, `groupConversations`, `filterConversations`, `formatConversationDate`, `pickRestored`, `copyConversations`.
- `ChatMessageData.attachments` draws what the person sent above their bubble; `Composer stagedPosition="above"` stages pictures above the text.
- `docs/fleet-chat-matrix.md`: every product's chat, side by side.

- Embedded conversations now let scroll gestures reach the actual page or ancestor scroller. Reading an older answer stays stable through status updates, arriving assistant turns and resizing; a new user message or the return-to-latest action resumes following. The same behavior is covered in page, panel and nested browser fixtures.
- Release verification installs the browser required by the package's own checks.
