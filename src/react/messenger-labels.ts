import type {
  MessengerDayLabels,
  MessengerPreviewLabels,
  MessengerRefusalLabels,
  MessengerTitleLabels,
  MessengerTypingLabels,
} from "../messenger.js";

/**
 * Every word the Messenger shows. English here; a product in another language
 * passes its own (`labels`), a few or all. `{token}` is replaced; nothing is
 * ever glued together from parts, so each sentence can be translated whole.
 */
export type MessengerLabels = {
  // ── the list ──
  title: string;
  newConversation: string;
  search: string;
  searchPlaceholder: string;
  filter: string;
  filterAll: string;
  filterUnread: string;
  listEmpty: string;
  listEmptyAction: string;
  /** "{query}" is what was typed. */
  noMatch: string;
  noUnread: string;
  listFailed: string;
  retry: string;
  loading: string;
  /** For a screen reader, on a row's badge: "{n} unread". */
  unread: string;
  conversations: string;
  /** Beside the list on a wide screen, with nothing open. */
  pickOne: string;

  // ── the top of a conversation ──
  back: string;
  online: string;
  /** "{n} people". */
  people: string;
  /** "{name} is in this conversation". */
  agentHere: string;
  more: string;
  leave: string;
  leaveConfirm: string;
  leaveFailed: string;

  // ── the thread ──
  /** "Conversation with {name}". */
  thread: string;
  threadEmpty: string;
  threadFailed: string;
  /** "Type {mention} to bring {name} in. Everyone here sees its answer." */
  agentHint: string;
  loadOlder: string;
  loadingOlder: string;
  olderFailed: string;
  newMessages: string;
  jump: string;
  you: string;
  edited: string;
  sending: string;
  sent: string;
  read: string;
  notSent: string;
  retrySend: string;
  discard: string;
  agent: string;
  /** "for {name}". */
  onBehalfOf: string;
  /** "{name} is thinking…". */
  thinking: string;
  /** "{name} has not answered. Ask again in a moment." */
  agentQuiet: string;
  dismiss: string;
  typing: MessengerTypingLabels;
  reconnecting: string;
  offline: string;

  // ── the box ──
  placeholder: string;
  composer: string;
  send: string;
  attach: string;
  /** "Ask {name}". */
  askAgent: string;
  cannotWrite: string;
  editing: string;
  cancel: string;
  waitForUploads: string;
  // ── a voice message ──
  voiceMessage: string;
  voiceHint: string;
  voiceStart: string;
  voiceStop: string;
  /** "Recording {time}". */
  voiceRecording: string;
  voiceFailed: string;
  voiceTake: string;
  voiceAgain: string;
  voiceAdd: string;
  sendFailed: string;
  editFailed: string;
  removeFailed: string;

  // ── files ──
  /** "Uploading {name}". */
  uploading: string;
  /** "{name} could not be uploaded." */
  uploadFailed: string;
  retryUpload: string;
  removeUpload: (name: string) => string;
  refusal: MessengerRefusalLabels;
  preview: MessengerPreviewLabels;
  download: string;
  /** "Open {name}". */
  open: string;
  playVideo: string;
  viewer: string;
  close: string;
  previous: string;
  next: string;
  /** "{i} of {n}". */
  position: string;
  unavailable: string;

  // ── what can be done to a message ──
  actions: string;
  reply: string;
  /** Above the box while answering: "Replying to {name}". */
  replyingTo: string;
  /** On a quote whose message is not loaded: a screen reader's name for it. */
  quoted: string;
  /** "React with {emoji}". */
  react: string;
  /** On a chip: "{emoji}, {n}". */
  reactionCount: string;
  reactFailed: string;
  /** In the amount sheet of an app's action. */
  amount: string;
  note: string;
  amountInvalid: string;
  copy: string;
  edit: string;
  remove: string;
  removeConfirm: string;

  // ── a new conversation ──
  newTitle: string;
  peopleSearch: string;
  peoplePlaceholder: string;
  peopleHint: string;
  peopleEmpty: string;
  peopleFailed: string;
  start: string;
  startFailed: string;

  days: MessengerDayLabels;
  titles: MessengerTitleLabels;
};

export const DEFAULT_MESSENGER_LABELS: MessengerLabels = {
  title: "Messages",
  newConversation: "New",
  search: "Search conversations",
  searchPlaceholder: "Name or message",
  filter: "Which conversations",
  filterAll: "All",
  filterUnread: "Unread",
  listEmpty: "No conversations yet.",
  listEmptyAction: "Start a conversation",
  noMatch: "No conversation matches “{query}”.",
  noUnread: "Nothing unread.",
  listFailed: "Your conversations could not be loaded.",
  retry: "Try again",
  loading: "Loading",
  unread: "{n} unread",
  conversations: "Conversations",
  pickOne: "Choose a conversation, or start a new one.",

  back: "Back to conversations",
  online: "Online",
  people: "{n} people",
  agentHere: "{name} is in this conversation",
  more: "More",
  leave: "Delete conversation",
  leaveConfirm: "Delete it for you? The others keep theirs.",
  leaveFailed: "The conversation could not be deleted. Try again.",

  thread: "Conversation with {name}",
  threadEmpty: "No messages yet. Say hello.",
  threadFailed: "The messages could not be loaded.",
  agentHint: "Type {mention} to bring {name} in. Everyone here sees its answer.",
  loadOlder: "Earlier messages",
  loadingOlder: "Loading earlier messages",
  olderFailed: "Earlier messages could not be loaded. Try again",
  newMessages: "New",
  jump: "Jump to the latest message",
  you: "You",
  edited: "edited",
  sending: "Sending",
  sent: "Sent",
  read: "Read",
  notSent: "Not sent.",
  retrySend: "Try again",
  discard: "Delete",
  agent: "Agent",
  onBehalfOf: "for {name}",
  thinking: "{name} is thinking…",
  agentQuiet: "{name} has not answered. Ask again in a moment.",
  dismiss: "Dismiss",
  typing: {
    one: "{name} is typing…",
    two: "{a} and {b} are typing…",
    several: "Several people are typing…",
  },
  reconnecting: "Reconnecting…",
  offline: "You are offline. New messages will show when you are back.",

  placeholder: "Message",
  composer: "Write a message",
  send: "Send message",
  attach: "Add a photo, video or file",
  askAgent: "Ask {name}",
  cannotWrite: "You can no longer write in this conversation.",
  editing: "Editing your message",
  cancel: "Cancel",
  waitForUploads: "Wait for the upload to finish",
  voiceMessage: "Voice message",
  voiceHint: "Record it, listen, then send",
  voiceStart: "Start recording",
  voiceStop: "Stop recording",
  voiceRecording: "Recording {time}",
  voiceFailed: "The microphone could not be opened. Allow it for this site and try again.",
  voiceTake: "Your recording",
  voiceAgain: "Record again",
  voiceAdd: "Add to message",
  sendFailed: "The message was not sent. It is still in the box; try again.",
  editFailed: "The change was not saved. Try again.",
  removeFailed: "The message could not be deleted. Try again.",

  uploading: "Uploading {name}",
  uploadFailed: "{name} could not be uploaded.",
  retryUpload: "Try again",
  removeUpload: (name) => `Remove ${name}`,
  refusal: {
    type: "{name} cannot be sent here.",
    size: "{name} is too large (max {max}).",
    count: "Up to {max} files in one message.",
    quota: "Your storage is full ({used} of {quota}). Delete older files to send new ones.",
    empty: "{name} is empty.",
  },
  preview: {
    you: "You: ",
    photo: "Photo",
    photos: "{n} photos",
    video: "Video",
    audio: "Audio",
    file: "File",
    attachments: "{n} attachments",
    empty: "No messages yet",
  },
  download: "Download",
  open: "Open {name}",
  playVideo: "Play video",
  viewer: "Photos and videos",
  close: "Close",
  previous: "Previous",
  next: "Next",
  position: "{i} of {n}",
  unavailable: "This file is no longer available.",

  actions: "Message",
  reply: "Reply",
  replyingTo: "Replying to {name}",
  quoted: "Go to the message this answers",
  react: "React with {emoji}",
  reactionCount: "{emoji}, {n}",
  reactFailed: "That reaction was not saved. Try again.",
  amount: "Amount",
  note: "Note (optional)",
  amountInvalid: "Enter an amount above zero.",
  copy: "Copy text",
  edit: "Edit",
  remove: "Delete",
  removeConfirm: "Delete for everyone",

  newTitle: "New conversation",
  peopleSearch: "Search people",
  peoplePlaceholder: "Name or @handle",
  peopleHint: "Type a name to find someone.",
  peopleEmpty: "Nobody found.",
  peopleFailed: "People could not be searched. Try again.",
  start: "Start conversation",
  startFailed: "The conversation could not be opened. Try again.",

  days: { today: "Today", yesterday: "Yesterday" },
  titles: { self: "Notes to self", more: "{names} and {n} more" },
};

/** Overrides: any label, and any part of the grouped ones. */
export type MessengerLabelOverrides = Partial<
  Omit<MessengerLabels, "typing" | "refusal" | "preview" | "days" | "titles">
> & {
  typing?: Partial<MessengerLabels["typing"]>;
  refusal?: Partial<MessengerLabels["refusal"]>;
  preview?: Partial<MessengerLabels["preview"]>;
  days?: Partial<MessengerLabels["days"]>;
  titles?: Partial<MessengerLabels["titles"]>;
};

export function messengerLabels(overrides?: MessengerLabelOverrides): MessengerLabels {
  if (!overrides) return DEFAULT_MESSENGER_LABELS;
  return {
    ...DEFAULT_MESSENGER_LABELS,
    ...overrides,
    typing: { ...DEFAULT_MESSENGER_LABELS.typing, ...overrides.typing },
    refusal: { ...DEFAULT_MESSENGER_LABELS.refusal, ...overrides.refusal },
    preview: { ...DEFAULT_MESSENGER_LABELS.preview, ...overrides.preview },
    days: { ...DEFAULT_MESSENGER_LABELS.days, ...overrides.days },
    titles: { ...DEFAULT_MESSENGER_LABELS.titles, ...overrides.titles },
  };
}
