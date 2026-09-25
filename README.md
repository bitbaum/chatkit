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
pnpm add github:bitbaum/chatkit#v0.1.0
```

`dist/` is committed, so the install needs no build step and no `allowBuilds`
entry. (npm publishing is set up once the package has its first release there.)

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
/>
```

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

1. A microphone in the composer, with the server fallback above.
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
8. Starters in the empty state; the speaker's name on every answer once more
   than one agent speaks.
9. Nothing overflows at 320–390px.

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

Release: bump `version` in `package.json`, merge, then
`git tag v<version> origin/main && git push origin v<version>`.

## Develop

```sh
pnpm install
pnpm run demo        # builds demo/dist; open demo/index.html
pnpm run verify      # everything CI runs
```

MIT © Cato
