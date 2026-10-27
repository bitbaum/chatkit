# chatkit

**One chat for every bitbaum product.** A composer with a microphone that never
goes dead, a thread that does not fight the reader, answers with Copy and Retry,
and LLM markdown — the fleet's chat standard as a package, so a fix made once
reaches every product.

Why it exists: on 2026-09-25 there were 13 chats in 10 repos, each written from
scratch, each missing something another had already fixed — most often the
microphone. The person using them found every gap by hand. This package is the
one place those fixes now live. (Model calls, streaming and transcription stay
in [`ai-kit`](https://github.com/bitbaum/ai-kit), server-side; chatkit is the
interface that calls them.)

## Install

```sh
pnpm add @bitbaum/chatkit
```

**Install releases from npm, never a commit or a branch.** A semver range is
what lets a fix reach every product: Renovate/Dependabot opens the bump PR in
each app when a release ships. A pinned commit or tag silently freezes the app
on whatever it pinned — heidi and substrata kept the broken Android paperclip
for days after the fix merged, because one pinned `v0.2.0` and npm had only
`0.2.1`.

## Use

```tsx
import { ChatStarters, ChatThread, Composer } from "@bitbaum/chatkit/react";
import "@bitbaum/chatkit/styles.css";

<ChatThread
  messages={messages}               // { id, role, content, speaker?, citations?, failed? }
  live={streaming ? { text: partial } : null}
  onStop={stop}
  onRetry={retryLast}
  empty={<ChatStarters starters={["What can you build for me?"]} onPick={send} />}
/>
<Composer
  onSend={(text, attachments) => send(text, attachments)} // return false to keep the draft
  placeholder="Ask about any project…"
  sending={streaming}
  onStop={stop}
  voice={{ transcribeUrl: "/api/transcribe" }}
  attach                             // only if your API accepts attachments
  tools={<ModelPicker />}            // app-specific controls go in slots
  heldAttachments={refs.length}      // attachments the APP keeps (shown in `header`)
  attachmentOnlyText="See attached"  //   so a message of only those can still send
/>
```

### The whole screen — `ChatScreen`

A chat page is the conversation, edge to edge and top to bottom, as in the
ChatGPT and Claude apps. The header and the composer float OVER it instead of
each taking a strip of the screen: words scroll under both and fade as they
pass, the header's buttons are frosted pills (`ck-glass`), and the composer is
a see-through pill. The last line of an answer always rests above the
composer — the scroller is padded by the measured height of each.

```tsx
<ChatScreen
  fill="viewport"                    // or "parent": fill the box you give it
  header={<>
    <button className="ck-glass" aria-label="Chats"><IconMenu /></button>
    <span style={{ flex: 1 }} />
    <button className="ck-glass" aria-label="New chat"><IconPen /></button>
  </>}
  composer={<Composer … />}           // plus an error or a queue, if you have one
  footnote="Answers can be wrong."
>
  <ChatThread … />
</ChatScreen>
```

`fill="viewport"` follows the VISUAL viewport, so the composer rides above the
phone keyboard. An app with its own thread pads its scroller with the two
measured heights: `padding-block: var(--ck-top-inset) var(--ck-bottom-inset)`.
The reading column is `--ck-measure` (48rem) wide with `--ck-gutter` (1rem)
to the edge; the page behind it is `--ck-page`. `demo/screen.html` is the
reference: look at it at 390px before changing any of this.

### The whole app — `ChatApp`

`ChatScreen`, `Composer` and `ChatThread` are the pieces. Until 0.18 every
product built the app around them itself — the chat list, New chat, Temporary
chat, titles, rename and delete, what a reload reopens — and each did it a
little differently (`docs/fleet-chat-matrix.md` has the table). `ChatApp` is
that app, once: what a person sees in the Claude or ChatGPT phone app, set by
this package and changed only through props.

```tsx
import { ChatApp } from "@bitbaum/chatkit/react";
import { httpConversationStore, localConversationStore } from "@bitbaum/chatkit";

const store = signedIn
  ? httpConversationStore({ baseUrl: "/api/conversations" })
  : localConversationStore({ key: "heidi-chat" });

<ChatApp
  name="Heidi"
  store={store}
  transport={async ({ text, attachments, history, signal, update }) => {
    const answer = await streamFromMyApi({ text, attachments, history, signal, onText: (t) => update({ text: t }) });
    return answer; // a string, or { content, replies?, citations?, thinking? }
  }}
  composer={{ voice: { transcribeUrl: "/api/transcribe" } }}
  starters={["Explain this word", "Translate a message"]}
/>;
```

What it owns, so no product writes it again:

- **The header**: frosted pills — Chats (a phone; from `railQuery`, default
  64rem, the list is a rail beside the chat instead) · the chat's title ·
  New chat · "…" with Temporary chat, Share this chat (with `onShare`),
  Rename and Delete. `headerStart` / `headerEnd` take the product's own
  controls (a model picker, a back link).
- **The chat list**: a full-height drawer on a phone (a native `<dialog>`:
  Escape, the focus trap and focus restore come from the browser; it opens on
  its close button, never on the search box, so no keyboard jumps up), a rail
  on a wide screen. New chat, a search box (every word, accents ignored — or
  your `search`, e.g. searchkit), Today / Yesterday / Earlier, and rows with
  ONE anatomy: title, date (or "Answering…"), one "…" that opens Rename ·
  Delete as two equal cells; Delete asks once, in the row. An empty list and a
  failed load each say so, the second with Try again.
- **New chat and Temporary chat.** A temporary chat is never written to the
  store and ends when it is left; the transport gets `temporary: true` and
  `conversationId: null`, so a server that persists turns itself knows not to.
- **Titles**: the first message names a chat (`deriveTitle`, Heidi's rule);
  `makeTitle({ text, answer })` renames it after the first answer if you have
  something better.
- **Reload**: the open chat comes back (`rememberKey`, device storage — never
  a temporary one), unless it was deleted elsewhere. A product that keeps the
  chat in its URL passes `conversationId` and `onConversationChange` instead.
- **Turns**: one per conversation, and a turn keeps running when the person
  opens another chat (its row says "Answering…"). Stop keeps what had arrived.
  A failed turn shows Retry. A message sent while an answer runs is queued
  above the composer, with its own ×, and goes when the answer lands.
- **The composer**: attachments ON (Camera · Photos · Files, thumbnails above
  the text, each with its ×, shown in the sent turn too), the microphone,
  suggested replies, and the screen's visual-viewport sizing (`fill`).

**The transport** is the product's one job: `(turn) => Promise<answer>`.
`turn` is `{ conversationId, temporary, text, attachments, history, signal,
update }`; call `update({ text, status, steps })` as the answer streams (the
whole text each time); throw for a failed turn.

**The store** is an adapter — six methods, `ConversationStore`:
`list() · get(id) · create({ title }) · append(id, message) · rename(id,
title) · remove(id)`. Two come with the package:

- `localConversationStore({ key })` — the device. Versioned (`<key>:v1`),
  one key per chat; never throws: storage that is missing, blocked (private
  mode) or full degrades to memory for the page, and a full quota drops the
  OLDEST chats first. Pictures are kept by name, not bytes.
- `httpConversationStore({ baseUrl })` — the product's server, over
  Heidi's shape: `GET {base}` → `{ conversations }`, `POST {base}` →
  `{ conversation }`, `GET {base}/{id}` → `{ conversation, messages }` (404 =
  gone), `POST {base}/{id}/messages` `{ message }`, `PATCH {base}/{id}`
  `{ title }`, `DELETE {base}/{id}`. `serverWritesTurns: true` when the
  product's chat route already stores each turn, so nothing is written twice.

Signed out on the device, signed in on the server: pass the store for who is
there. `copyConversations(local, server)` moves the device's chats into the
account on sign-in.

`demo/app.html` is the reference — look at it at 390px and 1440px.
`test/browser-app.mjs` drives it at both widths: send, the drawer (focus in
and back out), New chat, a temporary chat that leaves no row, a reload that
reopens the chat, a picture staged above the text and removed, delete, the
queue and Stop — and checks for sideways scroll, 44px targets and cut words
at every step.

#### Moving a product onto ChatApp

Per product, from the matrix: what goes, what stays. What stays is always
the same two things — the transport and the words.

- **Loki** — goes: `ThreadRail.tsx`, the history half of
  `WorkspaceDrawers.tsx` and `WorkspaceChrome.tsx`, `ThreadTitle.tsx`,
  `hooks/use-temporary-chat.ts`, `hooks/use-new-chat.ts`,
  `hooks/use-send-queue.ts` + `QueuedMessages.tsx`, the history-pin storage.
  Stays: `use-loki-stream` as the transport (its `ephemeral` flag from
  `turn.temporary`), `ModelPicker` and the project chip in `composer.tools`,
  the dispatch and handoff cards in `thread.renderFooter`,
  `httpConversationStore({ baseUrl: "/api/conversations", serverWritesTurns:
  true })`, `?c=` through `conversationId`. Not in ChatApp yet, so ask for it
  here first: pinned chats, the "needs me first" line and by-project view,
  hands-free voice conversation.
- **OrangeCat** — goes: `ConversationRail.tsx`, `hooks/useConversations.ts`
  (incl. its temporary chat), `hooks/useChatHistory.ts`, the header row of
  `ChatHeader.tsx`. Stays: the Cat's stream as the transport,
  `ComposerAddMenu` (the person's own things) in `composer.tools` with
  `heldAttachments`, tool chips and pending actions in `thread.renderFooter`,
  the quota meter in `headerEnd`. Its conversation routes are not the REST
  shape above: a six-method store over `API_ROUTES.CAT`, or align the routes.
  Gains: reopening the chat after a reload, rename, search.
- **Heidi** — goes: `conversation-list.tsx`, `new-chat-button.tsx`, the
  header and drawer state in `workspace.tsx`, the storage half of
  `use-conversation.ts`, the signed-out draft restore (`use-draft`) →
  `localConversationStore`. Stays: `transports.ts` (its `Transport` maps onto
  this one: `onText` → `update`, a `status: "error"` result → a throw), the composer labels and picture limits, the answer view
  and word pick in `thread.renderFooter`, the model sheet in `headerEnd`.
  Store: `httpConversationStore({ baseUrl: "/api/conversations",
  serverWritesTurns: true })` signed in. Gains: a temporary chat.
- **Substrata** — goes: the `ChatScreen` + `Composer` + `ChatThread`
  assembly in `ResearchChat.tsx`, `lib/ask-thread.ts` (the tab handoff →
  `conversationId` + the device store). Stays: `useChatSession` as the
  transport, `AskTools` / `ComposerBeside` in `composer.tools` and
  `footnote`, `chartRenderers`, `AnswerFooter`. Decide: attachments are ON in
  ChatApp; `/api/chat` takes no files today, so either keep
  `composer={{ attach: false }}` or accept pictures there.
- **Diplodoctor** — goes: the assembly in `app/[locale]/ask/page.tsx`.
  Stays: the redacting `ask()` as the transport, the labels. Gains: a chat
  list and reload. Needs: a transcription route (voice is off today) and an
  API that takes files before `attach` is turned on.
- **Causius** — stays as it is for now. A matter is a case with documents,
  participants and steps, not a chat; its list is the matters page.
  `ChatThread` + `IntakeComposer` remain the right pieces.
- **evig** — goes: the header and Clear in `HirnChat.tsx` and
  `HirnChatPanel.tsx`. Stays: `/api/hirn/chat` as the transport, the action
  cards in `thread.renderFooter`, `useChatLabels`. Store: the Hirn history
  route is per session, not the REST shape — a six-method store, or the
  device store for the panel.
- **Solon** — goes: the header, "New conversation" and the React-state
  history in `governance-chat.tsx` and `law-chat.tsx`. Stays: the SSE read as
  the transport, the starters, `renderLink`. Gains: chats that survive a
  reload (the footnote promises "stays in this tab" and today nothing does).
  Signed out keeps its own "Sign in to ask Solon" screen instead of ChatApp.

### The microphone

`voice` is on by default. Give it a server leg so it works everywhere:

- `transcribeUrl`: an endpoint taking `multipart/form-data` `{ audio, locale }`
  and answering `{ text }` — implement it with `ai-kit`'s `transcribe()`.
- or `transcribe: (audio, locale) => Promise<string>` for a custom call.

The browser's own recogniser is tried first (free, instant). Where it is
missing, **or accepts `start()` and then says nothing** — Chromium without
Google's speech service does exactly that — the same press records and the
server transcribes. The dead recogniser is remembered for 30 days so the next
press records immediately. Every failure is shown in words (blocked mic,
nothing heard, not available), never as a button that does nothing.
`prefer: "server"` skips the browser leg (one model everywhere, language
detected by the model). `rememberKey: null` stores nothing on the device.

### Suggested replies

The two to four things the person is likely to say next, as buttons under the
latest answer — one tap sends it. The model writes them in the same turn, so
there is no second call and no wait:

```ts
import { REPLIES_INSTRUCTION } from "@bitbaum/chatkit";
const system = `${yourPrompt}\n\n${REPLIES_INSTRUCTION}`; // server side
```

```tsx
<ChatThread messages={messages} onReply={send} … />
```

Below 40rem the replies are one row that scrolls sideways with a fade, the
lead reply first and always on screen; wider, they wrap. The Copy · Listen ·
Share · Retry row under an answer keeps each word on one line and every button
at the 44px target (0.12.1).

That is the whole integration. `ChatThread` takes the `quick_replies` block out
of every answer (and out of a streaming one before it has finished, so nobody
watches JSON appear), and shows the buttons under the latest answer only, never
while a turn runs. Pass `replies` on a message to supply your own instead.
An app with its own thread uses `extractReplies(text)` and `<ChatReplies>`, so
the buttons look and behave the same everywhere.

The model leads. The instruction asks for replies on EVERY answer, the
recommended next step first, and the first button is drawn as the lead
(`ck-reply-lead`): on a phone the answer is read and the next move is one
tap, the way Grok does it. Only an answer that ends the conversation has no
buttons.

No heading over the buttons (0.15.1). Models like to write their own
"**Quick follow-up options**" (or "Suggested replies", "Mögliche
Rückfragen:", …) as the last line above the block; drawn over the buttons it
reads as an empty section. The instruction tells the model not to, and
`extractReplies` drops it anyway — decided by shape and position, not a word
list, so it holds in every language: the last block before the replies, a
heading or a bold/italic-only line of at most six words with no sentence
punctuation but a closing colon, plus an `---` beside it. A bold sentence
("**China holds 99 %.**") stays. While streaming (`{ streaming: true }`, which
`ChatThread` passes) such a line is held back until the next line shows what
it is, so it never flashes. `dropReplyLabel(text)` is exported for apps that
pass their own `replies`.

### Under every answer — Copy, Listen, Share

`AnswerActions` is the row under an answer, the same in every product:

```tsx
<AnswerActions text={answer} onRetry={retry} speaker={studioVoice} share={{ url }}>
  <YourOwnButton />
</AnswerActions>
```

Copy copies the markdown. Listen reads the answer aloud as prose (headings,
emphasis, citations and code fences stripped — `plainTextForSpeech`) with the
browser's own voice, or with the `speaker` you pass (`{ speak(text), cancel() }`
— loki hands in its studio voice); while it reads, the row becomes a small
player: Stop and the time so far. Share opens the system share sheet with the
answer's prose (or what you pass), only where one exists. A button that does
nothing is never shown. `ChatThread` renders it under every answer; pass
`speaker` and `share` through.

### Dictation reads Android's cumulative results once (0.15.2)

Android's Chrome-family recognisers (Chrome, Brave, Samsung Internet) report
one utterance cumulatively — "why", "why exactly", "why exactly is", … — often
every one of them flagged final. The hook appended every final, so Substrata's
Ask box on Brave typed the sentence once per word (2026-10-25). The transcript
is now rebuilt from the recogniser's whole results list on every event by
`heardFromResults` (core, pure), which collapses a growing chain to its last
link. Desktop finals are untouched: two different phrases stay two, and a word
the person really repeats as separate results stays repeated. The one
limitation — "no" then "no no" as two separate results reads as one utterance
growing — is written down beside the rule. `test/dictation.test.js` holds the
fixtures; `test/browser.mjs` drives the real composer with a fake cumulative
recogniser and fails on the old hook.

### Charts in answers (0.15)

"Who produces gallium?" is answered with a ranked bar chart, not a list.
chatkit stays dependency-free: it defines the **data contract** and a
**renderer slot**; the drawing is the app's. Substrata injects
[`@bitbaum/chartkit`](https://github.com/bitbaum/chartkit), whose components
take exactly the block's fields, so a block spreads into the matching one:

```tsx
import { BarChart, LineChart, ShareBars, Timeline, StatTiles } from "@bitbaum/chartkit";
const renderers = {
  chart: (b) =>
    b.chart === "bars" ? <BarChart {...b} /> : b.chart === "line" ? <LineChart {...b} /> : b.chart === "share" ? <ShareBars {...b} /> : b.chart === "timeline" ? <Timeline {...b} /> : <StatTiles {...b} />,
};
<ChatScreen renderers={renderers} …>   // every answer on the screen
<ChatThread renderers={renderers} …>   // or one thread; Markdown and RichAnswerBlock take it too
```

Without a renderer, or when one returns `null` for a kind it does not draw,
chatkit draws the **fallback itself**: the caption and a `.ck-table` of the
data, so a chart is never a blank. A malformed block (a share of 140, a link
with a script in it) is rejected by the parser and degrades to the same table
of whatever rows were safe — the renderer never sees it. Copy and Listen read
the figures as lines.

The model writes a chart in the same fenced `chat_ui` JSON as every other
block. `RICH_ANSWERS_INSTRUCTION` now says when to draw one — ranked
quantities with 3+ rows → `bars`; shares of one whole → `share`; a quantity
over time with 3+ points → `line`; 3+ dated events → `timeline`; 2–4 headline
figures → `tiles` — that every number comes from a tool result, and that each
row's `href` is copied from the result's page or link.

The contract (`ChartBlock`, exported; limits are the parser's):

```ts
{ type: "chart", chart: "bars",     caption, unit?, highlight?, rows: [{ label, value, href?, share?, note?, estimated? }] }   // ≤ 24 rows
{ type: "chart", chart: "share",    caption, other?, rows: [{ label, share, href? }] }                                        // share 0–100
{ type: "chart", chart: "line",     caption, unit?, series: [{ id, label, points: [{ x, y, href?, note? }] }] }               // ≤ 6 series, ≤ 120 points
{ type: "chart", chart: "timeline", caption, events: [{ date, label, href?, tone?: "up" | "down" | "neutral", kind? }] }     // ≤ 24 events
{ type: "chart", chart: "tiles",    caption, tiles: [{ label, value, href?, note? }] }                                       // ≤ 6 tiles
```

An `href` is a same-site path or a web URL, never anything else. The block
sits in the answer column with the stack figure's margins (`.ck-rich
.ck-chart`); `test/browser.mjs` renders one through a stub renderer and one
through the fallback at 320, 390 and 1280px, runs the broken-word scan over
them and asserts no horizontal overflow.

### Words are never cut (0.14.1)

A word may wrap onto the next line; it may never be cut in two. `.ck-md` sets
`overflow-wrap: anywhere` so a long URL cannot push the thread wider, but
`anywhere` also lowers a table cell's minimum width to one letter, and
Substrata's three-column answer at 390px read "Te / rm" and "Di / re / ct /
or / y" (2026-10-22). Tables now keep every word whole: columns share the width
by wrapping at spaces, and when even the words do not fit the table scrolls
sideways with a shadow on the edge that has more. The stack figure's tiles
wrap too: three across becomes two and one, or one under the other, rather
than cut "Manufacture".

`test/browser.mjs` measures it rather than reading the CSS: every word on the
page is laid out in a `Range` at 320, 390 and 1280px and must sit on one line
(a word beside a hyphen, slash or dot, and anything over 24 characters, is
exempt: a URL has to break somewhere). The demo thread carries the table from
the screenshot, so the check fails on the old stylesheet.

The check is exported so any product can run it against its own pages, from a
Playwright script (never from app code):

```js
import { BROKEN_WORDS_SOURCE } from "@bitbaum/chatkit/audit";
const broken = await page.evaluate(`(${BROKEN_WORDS_SOURCE})(document.body)`);
if (broken.length) throw new Error(`words cut across lines: ${broken}`);
```

### The feedback loop (0.14)

Two halves, one shape, so a bad answer is found by the product, not by the
owner tripping over it.

- **Under every answer, a thumb up and a thumb down** — pass `onFeedback` to
  `ChatThread` (or `messageId` + `onFeedback` to `AnswerActions`). A thumb
  down opens a sheet: one tap on why (`FEEDBACK_REASONS`: wrong, gave up
  instead of looking, vague, misread, too long, hard to read, other), words
  optional, then Send. The app gets `{ messageId, verdict, reason?, text? }`
  and keeps it with the conversation.
- **A nightly judge.** A product exports a day of conversations as
  `ChatTranscript[]` (turns with the steps the assistant took, plus the
  thumbs); a reviewer asks a model, with `CHAT_REVIEW_INSTRUCTION` and
  `reviewPrompt(scope, transcript)`, what the person most likely wanted, what
  the product could have given with the tools it has, and what it gave, and
  reads the verdicts back with `parseChatReview` (`score` 1–5, `gaps` from
  `REVIEW_GAPS`: dead_end, wrong_tool, no_web, misread, vague, no_next_step…,
  and one concrete `fix`). In the fleet, Loki runs the judge and files each
  gap into its feedback inbox, where fixes are built.

### The next message while a turn runs

`queue` keeps Send live while `sending`, beside Stop, and the placeholder
reads "Queue a message…": the app receives the message through `onSend` as
usual and sends it on when the turn ends. Without it a send during a turn is
refused, which holds the next thought until a spinner stops.

### Recordings

With a server leg, the paperclip also takes a recording that already exists —
a voice memo from the phone's recorder, a taped meeting. It is dictation that
happened earlier: the file is posted to `transcribeUrl` under its own name
(Whisper reads the container from the extension) and the words land in the box
like a mic take, never staged as an attachment the model would have to read.
Files are recognised by type and, where a picker hands them over typeless as
Android does with `.m4a`, by extension. Uploads are capped at
`MAX_AUDIO_FILE_BYTES` (120 MB — an hour of phone memo with room to spare);
over it, the person is told in words before any bytes move. Your server leg
should compress and split long audio before Whisper; loki's does.

### Camera, Photos, Files

On a touch screen the paperclip opens a sheet with three choices — Camera,
Photos, Files — each its own file input. One input with a mixed `accept`
(`image/*,text/*,audio/*`) is what a phone answers with a chooser of capture
apps (Camera, Camera, Recorder, "Photos & Videos"), where the screenshot you
came to send is three levels down and the file browser is not offered at all.
`ATTACH_SOURCE_INPUT` is the SSOT: Camera captures, Photos opens the system
photo picker, Files has no `accept` and opens the real document browser.
Because Files takes anything, `isTextFile` decides afterwards what can be read
inline; a PDF gets a sentence, not a prompt full of bytes. With a mouse the
paperclip opens the file dialog directly — on a desktop all three are the
same dialog. A box that is not chatkit's composer renders `<AttachMenu
onFiles={…} />` rather than a bare `<input type="file">`. An app with more to
bring into a message than files — one of the person's own things, a note the
model reads every time — passes `extra={(close) => <YourRows />}`: the rows
sit under the three sources in the same sheet, and the sheet then opens on a
mouse too, since a file dialog cannot hold them. Labels:
`labels={{ attachMenu: { title, close, sources: { camera, photos, files } } }}`.

### Picking files anywhere — `@bitbaum/chatkit/attach`

An app with no chat still has uploaders (an avatar, product photos, a receipt).
They need the same thing from a phone, so they use the same piece:

```tsx
import { AttachMenu, shrinkImage } from "@bitbaum/chatkit/attach";

<AttachMenu
  sources={["camera", "photos"]} // an image uploader offers no Files
  trigger="Add photo"
  onFiles={(files) => upload(files)}
/>;
```

`sources` narrows the sheet (one source skips it). `shrinkImage(file, maxEdge,
maxBytes)` is the in-browser downscale the composer uses. `acceptFamilies` and
`ATTACH_SOURCE_INPUT` are the rule itself.

### The check every app runs in CI

```sh
pnpm exec chatkit-check-file-inputs            # src app components
```

Fails on any file input whose literal `accept` mixes families (image + text,
audio + text…) — the exact shape that hid screenshots on Android. One input per
family, or `AttachMenu`. A real exception carries
`// chatkit-allow-mixed-accept: <reason>` on the line or the line above.

### Screenshots

`attach` takes limits: `attach={{ maxImageEdge: 1024 }}` shrinks a picture in
the browser to 1024px on its longest edge and re-encodes it as JPEG before it
is staged, stepping quality down until it fits `maxImageBytes`. A phone
screenshot (~1290×2796, several MB) goes out at a few hundred KB: cheaper for
whoever pays for the vision model, and the full-resolution screenshot never
leaves the device. Off by default (`0`).

Every reason a file did not attach is a label — `labels={{ attachNotes: {
imageTooLarge: (name, mb) => … } }}` — so it reaches the reader in their
language.

### The look of an answer

`Markdown` renders what a model writes, never as HTML: paragraphs, headings
with their level, bullet, numbered, nested and task lists, tables (they scroll
sideways on a phone instead of breaking the page), rules, bold, italic, code,
links, web images and `[F1]` citation handles. Three things make an answer
read like the ChatGPT app's rather than a wall of text, and a model does all
three unprompted:

- **A list of named things becomes cards.** `1. **Option.** why` — every item
  opening with a bold lead — renders as a badge (the number, or the emoji the
  lead opens with: `**🤖 Robot.** …`), the name, and the body under it.
- **A table is a table**, with the header row kept.
- **Sources are listed once**, under the answer, from the handles the text
  cites and the `citations` map you pass (`{ F1: { label, detail, href? } }`).
  On a mouse they are a row of chips; on a touch screen ONE "Sources · n"
  button opens a sheet with every record — label, detail, link — because a
  row of chips on a phone was a row of cut-off words. `renderCitation`
  replaces the in-text superscript with your own; `renderSources` replaces
  the row with your own; `sources={false}` drops it. `SourcesRow` and `Sheet`
  are exported for an app that lists sources from elsewhere.

**0.13 — answers that read like the ChatGPT app's**, measured against it
screen by screen on a phone:

- **Headings are signposts**: a size up, with air above them, so a long
  answer can be scanned and found again.
- **Options are cards**: a numbered list whose items open with a bold name
  gets a tile badge, the name a size up, a hairline between cards, and a pill
  for a short tag written right after the name — `1. **Federated.**
  [Recommended] …`. The instruction asks the model to mark the one it
  recommends exactly that way.
- **Sources are chips**: a `[F2, F1]` handle is drawn after the sentence as
  "Fleet AGENTS.md +1", linked when the record has a link, and moved after
  the full stop when the model wrote it before. `renderCitation` still
  replaces it.
- **Links that leave the site say so**: a dotted underline and a small arrow.
- **A layered figure** — `{"type":"stack", …}` — for an architecture, a
  pipeline or layers of responsibility: full-width boxes top to bottom, a row
  of tiles where a layer has parts (with an icon from a closed list), the
  words that cross each arrow, an accent tone for the layer that matters, and
  a caption that says what the figure claims. `diagram` stays for an
  arbitrary graph.
- **"Thought for 3m 38s ›"** above an answer, from `message.thinking`
  (`{ durationMs?, steps?: [{ label, detail? }], summary? }`), closed by
  default; while a turn runs, `live.steps` shows the same row open with the
  newest step marked. `ThinkingRow` is exported for an app's own thread.

`demo/screen.html` shows all of it.

### Look

Every colour, radius and face is a `--ck-*` variable. They default to
[`@bitbaum/design-tokens`](https://github.com/bitbaum/design-tokens), so
OrangeCat, Loki, Solon and bitbaum match with no work. Any other app sets
`--ck-*` on the chat's container and keeps its own look. What you cannot
change is the behaviour — that is the point.

### Language

Every visible word is a label: `labels={{ send: "Senden", dictation: {...} }}`
on `Composer`, `labels` on `ChatThread`.

## The standard (what this package guarantees)

1. A microphone in the composer, with the server fallback above — and the
   same server leg for a recording picked as a file.
2. 16px text in the input and the messages (below that iOS zooms the page).
3. A composer that belongs to the conversation: auto-growing textarea, Enter
   sends, Shift+Enter breaks the line, IME composition respected, 44px targets,
   usable above the phone keyboard (`useViewportHeight`).
4. Stop in the send slot while a turn is in flight.
5. A failed turn shows as a failure with Retry — never silence.
6. Scroll follows new tokens only while the reader is at the bottom, with a
   jump-down button otherwise.
7. Markdown rendered, never as HTML; `javascript:` links stay text; Copy on
   every answer.
8. Starters in the empty state; suggested replies under the latest answer;
   the speaker's name on every answer once more than one agent speaks.
9. Nothing overflows at 320–390px.
10. In `ChatScreen`, the conversation fills the display and opens at the
    latest message, with its end above the composer, not behind it.
11. In `ChatApp`, the same app everywhere: one chat list with one row
    anatomy, New chat, Temporary chat that writes nothing, the open chat
    back after a reload, attachments on, a queue behind a running answer.

`pnpm run verify` proves all of it: unit and render tests, then
`test/browser.mjs` drives Chromium through the demo at desktop and 390px, light
and dark, and speaks into a fake microphone past a silent recogniser.

## Improving it — here, never in your app

When a chat in any product has a bug or is missing something, **fix it in this
repo**, add the check that would have caught it, bump the version, and let the
products pick the release up. A local patch in one app is how the fleet got 13
different chats. If your app needs something truly its own, it goes in a slot
(`tools`, `header`, `footer`, `renderFooter`, `renderLink`) — ask for a new slot
here rather than forking the component.

Release: bump `version` in `package.json` and merge. The merge publishes it
(`publish.yml` runs on main, skips a version already on npm, and tags the
commit `v<version>`). No manual tag.

## Develop

```sh
pnpm install
pnpm run demo        # builds demo/dist; open demo/index.html
pnpm run verify      # everything CI runs
```

MIT © Cato

### Visual answers (0.11)

Append `RICH_ANSWERS_INSTRUCTION` from `@bitbaum/chatkit` to a conversational
system prompt, alongside `REPLIES_INSTRUCTION`. The model can place fenced
`chat_ui` JSON blocks inline in its answer: galleries with captions and a
full-size image sheet, dependency diagrams, recommendation callouts, and
single-choice follow-ups. Markdown tables and step lists remain available.
`Markdown` renders these automatically; pass `onReply={send}` for choice forms.
`ChatThread` wires that callback only on the latest answer and disables it
while another turn is running. Historical forms remain readable.

Products keep their own model routing, tools, evidence rules, auth and `--ck-*`
tokens. For a JSON-output assistant such as Heidi, ask for rich blocks only
inside its free-text explanation string, never outside the answer envelope.
Images must come from supplied context or tool results. No HTML or executable
SVG is accepted. Images suppress referrers and broken thumbnails retain their
text labels. Blocks are bounded and validated; incomplete/invalid blocks are
hidden, so always include the takeaway in ordinary prose too. Diagram edges
retain their direction and labels, including branches and cycles.

Release this package before updating consumer lockfiles to `^0.11.0`.
Run `pnpm run verify`; `demo/index.html` is the visual reference in light/dark
and at phone width. The diagram and gallery artwork in the demo is a fixture.

### Audio in answers

A validated `chat_ui` block can attach a real audio asset:

```json
{"type":"audio","title":"Morning sketch","src":"/provided.wav","creator":"Studio","caption":"An original instrumental draft"}
```

The native player waits for explicit playback and does not preload the file.
Only attach URLs supplied by a person or a completed tool. Generation and
catalogue access belong to the app's media tools: this renderer does not
create a song or grant rights to redistribute it. Copy and speech preserve the
track's title, creator and caption. The demo WAV is an original synthesized
fixture; it is not a commercial track or a model-generated recording.

The browser word-layout audit uses Unicode word boundaries. Chinese, Japanese and Korean may wrap between characters; those legal breaks are accepted while squeezed Latin words, including words embedded in CJK text, are still reported. Whole-page and chart overflow checks remain separate.

### Scrolling in a page or panel

`ChatThread` detects whether its own panel, an ancestor, or the page scrolls.
Upward touch, wheel and keyboard gestures pause automatic following immediately,
including close to the bottom. Status updates and incoming assistant turns keep
the reading position. Sending a new user turn or choosing return-to-latest
resumes following. Full-screen `ChatScreen` keeps its bounded scroll containment;
embedded threads allow gestures to reach their surrounding page.
