# Changelog

## Unreleased

### ChatApp: what the first four products could not do with it (0.19)

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

### Earlier

- The scroll owner now handles DOM environments without `document.scrollingElement`; when a previously scrollable thread loses its scroll container, the stale listener is cleaned up safely instead of crashing. A browser regression fixture covers the transition after a prior owner was selected.
- `ChatApp` (`@bitbaum/chatkit/react`): the whole chat app — header, chat list (drawer on a phone, rail when wide), New chat, Temporary chat, titles, rename and delete, the open chat restored on reload, turns that keep running in the background, the queue, attachments on by default. Additive: `ChatScreen`, `Composer` and `ChatThread` are unchanged.
- `ConversationStore` with `localConversationStore` (device, versioned, never throws) and `httpConversationStore` (REST); `deriveTitle`, `groupConversations`, `filterConversations`, `formatConversationDate`, `pickRestored`, `copyConversations`.
- `ChatMessageData.attachments` draws what the person sent above their bubble; `Composer stagedPosition="above"` stages pictures above the text.
- `docs/fleet-chat-matrix.md`: every product's chat, side by side.

- Embedded conversations now let scroll gestures reach the actual page or ancestor scroller. Reading an older answer stays stable through status updates, arriving assistant turns and resizing; a new user message or the return-to-latest action resumes following. The same behavior is covered in page, panel and nested browser fixtures.
- Release verification installs the browser required by the package's own checks.
