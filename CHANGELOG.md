# Changelog

## 0.26.0 — `Messenger`: people talking to people, and to the agents among them

Owner, 2026-11-12, looking at OrangeCat's direct messages on a phone: the Cat had answered in a conversation between two people and "it's hard to tell whether it was the cat or my friend"; nothing said an AI was taking part; "you scroll down and then the half screen is taken"; and nothing could be attached. That messenger was built in the app (about 8,700 lines), so none of it could be fixed for the next product either. This is the messenger as a package.

- `@bitbaum/chatkit/messenger`: `Messenger` (the whole screen), and its parts `useMessenger`, `ConversationList`, `MessageThread`, `MessageAttachments`. The app implements `MessengerTransport` — `conversations`, `messages`, `send`, and whatever else it can do (`upload`, `subscribe`, `markRead`, `typing`, `edit`, `remove`, `people`, `open`, `leave`). No database, websocket or storage in the package. `styles/messenger.css` is the embedded sheet plus the Messenger's section, without ChatApp.
- **An agent is told from a person three ways**: the shape of its face, an "Agent" mark with whom it answered for, an outlined bubble; the top bar says it is in the conversation; a message naming it shows "… is thinking" until it answers, and says so if it never does.
- **Files**: Camera · Photos · Videos · Files, checked against `@bitbaum/threadkit`'s attachment policy before an upload starts, photos shrunk in the browser, progress and Try again per file, pictures and films in a full-screen viewer, a film drawn as its still.
- **The thread**: runs, day lines, a "New" line, ticks from threadkit's `readState`, a failed message kept with Try again, earlier messages loaded above with the reader's place kept, one bubble per message however often it arrives.
- `Composer`: `layout="inline"` (one row: attach · words · microphone · send), `attachmentsAlone` (a message of only files needs no words), `attach.take` (the app takes the files; nothing is read into the page), `attach.accept`, a `"videos"` source, and files dropped onto the box. Defaults unchanged.
- The Messenger's state is one pure function (`messengerReducer`), so its rules are tests that run in Node (`test/messenger.test.js`, 35). `test/browser-messenger.mjs` drives `demo/messenger.html` at 390px, 320px dark and 1280px: the box at the bottom with nothing under it, the thread filling the rest, 16px, 44px targets, no cut words, and every flow above. It found two defects before any product did: a read mark that cleared the badge on screen without telling the server, and a page of history that pulled the reader to the end of the thread.
- New dependency: `@bitbaum/threadkit` (the rules: who may write, how messages merge; it has no dependencies of its own). threadkit 0.1.2 adds the attachment policy, the mention matcher and `readState`; it was merged and tagged on 2026-11-12 but its npm publish was refused (the workflow is not yet the package's trusted publisher), so those three are carried word for word in `src/thread-rules.ts`, with threadkit's own tests (`test/thread-rules.test.js`) and a check against the installed threadkit wherever it already has them. The file says when it goes.

## Unreleased — Agents are members: an "Agent" mark and whom it works for

In a room where people and agents both answer, a reader has to know which is which and who answers for an agent's words. `ChatSpeaker` gains `kind: "agent" | "person"` (an agent gets a small "Agent" mark beside its name) and `onBehalfOf` (drawn as "Loki · for Georgy"). Both labels are translatable (`labels.agent`, `labels.onBehalfOf` with `{name}`), both optional, so existing apps are unchanged. The streaming turn shows the same line.

## Unreleased — `attach.sources`: a paperclip that offers only what the backend reads

Solon's chats read words and text files, not pictures, and had to switch attachments off entirely because the paperclip always offered Camera and Photos. `attach={{ sources: ["files"] }}` (on `Composer` and `ChatApp`'s `composer.attach`) draws only the listed sources, and a picture that arrives by paste or drop is refused with the `wrongType` note instead of being staged and dropped by the server. `acceptsImages(sources)` is exported. Default unchanged.

## Unreleased — A server's English never reaches a person in another language

Found 2026-11-10 on Solon's Russian page: the mic failed with the localized "voice input is unavailable" followed by the route's own "Sign in to dictate." Any app whose transcribe route answers in English showed English in every locale.

- `DictationProblem` gains `signIn` (401/403) and `busy` (429); 413 is `fileTooLarge`; everything else `unavailable`. The problem comes from the HTTP status (`problemForStatus`, `problemForTranscription`), and a custom `transcribe` may throw an error with a `status`. Each has an overridable label (`labels.dictation.signIn`, `.busy`; English defaults in `DEFAULT_DICTATION_MESSAGES`). `busy` can be retried like `unavailable`.
- The server's own sentence is no longer shown by default. `voice={{ showServerDetail: true }}` brings it back for a server whose text is localized.

## 0.23.0 — Any text box has the microphone; a thread of comments

Owner, 2026-11-06: every product installs the chat package and the text boxes people actually type in are still made by hand, with no microphone. A package that is installed and not used is no package. This release gives the other two shapes of "a person types words" a component, so there is nothing to build locally.

- `DictationField`: a labelled text area (or one line) with the composer's microphone — Web Speech, the recording fallback, the take shown with its timer and kept for a retry — appending to what is there; 16px text, 44px targets. Optional `improve={{ run, suggestions }}`: one tap on a suggestion, or say or type what to change; working, failure and **Undo** in words, the person's text untouched on failure. No model call and no prompt in chatkit: `run` is the app's.
- `CommentThread`: the conversation under anything. Oldest first, the box is `Composer` (mic, 16px, Enter sends), a `transport` the app implements (`post`, optional `remove`), optimistic removal rolled back with a message on failure, a refused post keeps the draft, comments shown as text with their line breaks, a sign-in link for a signed-out reader, times in a stated `timeZone` so server and browser markup agree.
- `VoiceBar` and `VoiceProblem` are now one implementation inside the package: `Composer` and `DictationField` draw the same take and the same failure line. `Composer` behaves as before (its existing browser checks pass unchanged).
- Styles for both are in `styles.css`, after the ChatApp boundary, so the embedded `styles/chat.css` keeps its size budget (10,464 bytes gzipped, unchanged).
- `test/browser-field.mjs`, on a new fixture page: a mic in every field and in the comment box at 390/320/1280px light and dark, 16px, no control under 44px, no sideways scroll, mic words appended to typed text, Improve in one tap, Undo, an improve failure that keeps the text and the instruction, a comment posted, listed, removed, and a refused one that keeps its draft.

## 0.22.1 — Back at the bottom by hand, the jump button goes; chips answer the question

- `REPLIES_INSTRUCTION`: when an answer ends on a question to the person, the replies are short answers to it, never the question repeated and not next steps. Found 2026-11-01 on Diplodoctor's live model: under four questions about a sore finger, the chips were "I have more info" and "Consult a doctor", and a tap answered nothing (2 of 9 chip sets were answers; 7 of 9 with this sentence added).

- A finger rocks back a pixel or two as it lifts. `useStickToBottom` read that last touchmove as "scrolling up" and paused following, so a reader who scrolled back down to the latest message by hand was left with the jump button sitting over the reply chips, and a tap on it did nothing: there was nowhere to jump to. Found 2026-11-01 in OrangeCat's Diplodoctor chat on Android. Where the gesture ends now decides: a touch that lifts at the very bottom (`isAtBottom`, 16px — far tighter than the follow threshold, so a deliberate small scroll up still pauses), or any downward scroll that arrives there (a fling running on after the finger lifted), is following again.
- Checked in `test/browser-scroll.mjs` on `ChatScreen` at 390px with real touch input: read up, come back down by hand with a 2px lift-off wobble, the button is gone; read up again, a TAP (not a scripted click) on the button lands at the latest message. The test fails on 0.22.0.

## 0.22.0 — The microphone listens until you press done, in every product

- With a server leg (`transcribe` or `transcribeUrl`) and no `prefer`, a press of the microphone now records until the person presses done, and the server transcribes. It used to start on the browser's recogniser, which on Android ends the take at the first pause whatever `continuous` says. Found 2026-11-01 in OrangeCat's bot chats: the composer there passed no `prefer`, so a person speaking to Causius was cut off after one or two seconds, while the Cat's composer (`prefer: "server"`) in the same app listened to the end. The same microphone now works the same way wherever it has a server leg. `prefer: "browser"` keeps the old order for an app that wants it; with no server leg nothing changes.
- `dictationLeg({ prefer, hasServer, canRecord, hasRecogniser, recogniserDead })` is the rule, exported and tested.

## 0.21.5 — A sheet taller than the screen scrolls inside it

- `Sheet` had no height cap (the native `<dialog>` cap is overridden so a bottom sheet can reach the edge), so a panel taller than the viewport grew past the top of the screen: OrangeCat's New bot sheet, a shelf of five bots over the name, shape and colour form, opened with its title, its close button and its first row cut off above the viewport on a phone and on a 900px desktop (found 2026-10-31). The dialog and its panel are now capped at the viewport and the panel scrolls, with its head in view and the page behind it not scrolling along. Checked in the browser test with a sheet made 3,000px tall.

## 0.21.4 — Any product's source handle is a chip

- Citation handles were read only as `[F1]` and `[D1]`. A product that numbers its sources by its own letter showed the bare handle in the answer, with no chip, no link and no sources row: Solon's law answers (`[L1]`, every answer since the law chat shipped), found 2026-10-31. Substrata had met the same limit and rewrites its `[W12]` to `[D12]` before display (`lib/chat/web-citations.ts`); that rewrite is no longer needed. A handle is now one or two capital letters and a number, the same pattern `speakableText` already dropped for Listen. Without a citation map, an answer is not grounded and `[A1]` is just words, so it is shown as written; in a grounded answer an unknown handle is still dropped.

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
