import type { MessengerDayLabels, MessengerPreviewLabels, MessengerRefusalLabels, MessengerTitleLabels, MessengerTypingLabels } from "../messenger.js";
/**
 * Every word the Messenger shows. English here; a product in another language
 * passes its own (`labels`), a few or all. `{token}` is replaced; nothing is
 * ever glued together from parts, so each sentence can be translated whole.
 */
export type MessengerLabels = {
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
    sendFailed: string;
    editFailed: string;
    removeFailed: string;
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
export declare const DEFAULT_MESSENGER_LABELS: MessengerLabels;
/** Overrides: any label, and any part of the grouped ones. */
export type MessengerLabelOverrides = Partial<Omit<MessengerLabels, "typing" | "refusal" | "preview" | "days" | "titles">> & {
    typing?: Partial<MessengerLabels["typing"]>;
    refusal?: Partial<MessengerLabels["refusal"]>;
    preview?: Partial<MessengerLabels["preview"]>;
    days?: Partial<MessengerLabels["days"]>;
    titles?: Partial<MessengerLabels["titles"]>;
};
export declare function messengerLabels(overrides?: MessengerLabelOverrides): MessengerLabels;
//# sourceMappingURL=messenger-labels.d.ts.map