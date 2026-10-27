# The fleet's chats, side by side (2026-10-27)

The question this answers: is every product's chat governed by this package?
The pieces are — every product renders chatkit's `Composer`, and most render
`ChatScreen` and `ChatThread`. **The app around them is not.** The chat list,
New chat, Temporary chat, titles, rename and delete, what a reload reopens,
the header, the attachment defaults and the queue were each written again in
each product, so each one looks and behaves a little differently, and the
defaults drift (Substrata passes `attach={false}`; Diplodoctor `voice={false}`;
only Loki queues). `ChatApp` (README → "The whole app") is that app, once.

Read from each repository's `main` on 2026-10-27, file by file. A cell says
only what the named file shows; "—" means the product does not have it.

| | Loki | OrangeCat | Heidi | Substrata | Diplodoctor | Causius | evig | Solon |
|---|---|---|---|---|---|---|---|---|
| **Chat files** | `src/components/loki/LokiWorkspace.tsx`, `Thread.tsx`, `ThreadRail.tsx`, `WorkspaceChrome.tsx` | `src/components/ai-chat/ModernChatPanel/index.tsx`, `components/ConversationRail.tsx`, `components/ChatInput.tsx`, `components/MessageBubble.tsx` | `app/[locale]/_components/chat/workspace.tsx`, `conversation-list.tsx`, `composer.tsx`, `transcript.tsx`, `transports.ts` | `components/portal/ResearchChat.tsx` | `app/[locale]/ask/page.tsx` | `components/matters/MatterWorkspace.tsx`, `IntakeComposer.tsx` | `src/components/admin/HirnChat.tsx`, `src/components/hirn/HirnChatPanel.tsx`, `src/components/deliverables/DeliverableChat.tsx` | `src/components/chat/governance-chat.tsx`, `src/components/law/law-chat.tsx` |
| **uses ChatScreen** | yes | yes | yes | yes (panel and `/chat`) | yes | no (`ChatThread` in the matter page) | yes (Hirn chat and panel); `DeliverableChat` no | yes |
| **history drawer** | own `ThreadRail` (pins, search from 8 chats, by project) | own `ConversationRail` (column on desktop, drawer on a phone; no search, no rename) | own `conversation-list.tsx` (rename, delete with a confirm) | — | — | — (a matter is the conversation; the list is the matters page) | — | — |
| **new chat** | yes (`use-new-chat`) | yes | yes (`new-chat-button.tsx`) | — | — | — | "Clear" (`HirnChat`) | "New conversation" pill (`governance-chat.tsx`) |
| **temporary chat** | yes: a server thread deleted on leaving (`hooks/use-temporary-chat.ts`) | yes: the same pattern (`hooks/useConversations.ts`, `lib/chat/temporary-chat`) | — | — | — | — | — | — |
| **attach (Camera · Photos · Files)** | yes, chatkit's (`components/composer/Composer.tsx`, `attach = true`) | own `ComposerAddMenu` (files and the person's own things); chatkit `heldAttachments` | chatkit's, only while the model can read pictures | **off** (`attach={false}`) | off (not passed) | own `AttachMenu` staging, Composer `attach={false}` + `heldAttachments` | off (not passed) | off (not passed) |
| **voice** | yes (`prefer: "server"`) | yes (`prefer: "server"`, own `transcribe`) | yes | yes | **off** (`voice={false}`: no transcription route) | yes (`prefer: "server"`) | yes (`transcribeForHirn`; `DeliverableChat` signed in only) | yes |
| **queue** | yes, own (`use-send-queue`, `QueuedMessages.tsx`) | — | — | — | — | — | — | — |
| **replies** | yes, own thread with `ChatReplies` | yes, own bubble with `extractReplies` | yes, own `transcript.tsx` | yes | yes | yes | yes | yes (signed in) |
| **share (answer)** | chatkit `AnswerActions` | yes | **off** (`share={false}`) | yes | yes | yes | yes | chatkit default |
| **feedback** | yes (`post-chat-feedback`) | yes (`lib/chat/feedback.ts`) | yes (`feedback.ts`) | yes | — | — | — | — |
| **stop** | yes | yes | yes | yes | yes | yes | yes | yes |
| **title generation** | server, from the first message | server, from the first message (`services/cat/conversation-history.ts`) | the first message, cut at a word (`lib/domain/chat/title.ts`) | — | — | the matter's title | — | — |
| **restore on reload** | `?c=` in the URL (`lib/loki/conversation-param.ts`) | — (lands on a new chat) | signed in: the server's list + a "resume" row; signed out: a device draft (`use-draft`) | same tab only (`sessionStorage`, `lib/ask-thread.ts`) | — | the matter page (server) | `HirnChat`: server history by session; panel — | — ("stays in this tab", held in React state only) |
| **own composer wrapper** | yes (`components/composer/Composer.tsx` → `loki/Composer.tsx`) | yes (`ChatInput.tsx`) | yes (`composer.tsx`) | no (`ComposerBeside` next to it) | no | yes (`IntakeComposer.tsx`) | no | no |

## What this means

- Three products built a chat list (Loki, OrangeCat, Heidi), three different
  ways: different rows, different places for rename and delete, search in
  one of them.
- Two built a temporary chat (Loki, OrangeCat) — the same idea twice, in two
  code bases.
- One queues a message typed during an answer (Loki). Everywhere else, Send is
  dead while an answer runs.
- Only Loki and Heidi reopen the chat you were in after a reload, each its own
  way; OrangeCat drops you on a new chat; Substrata keeps a chat for the tab.
- Attachments are on in two products, off in four, and built by hand in two.

`ChatApp` makes every row of this table one answer, set by the package.
The per-product migration is in the README ("Moving a product onto ChatApp").
