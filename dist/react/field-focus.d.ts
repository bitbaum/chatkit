import { type FocusEvent as ReactFocusEvent } from "react";
/**
 * Focus for a whole field, not for one element in it.
 *
 * A field is a text box, a microphone, Improve and the improve panel. A host
 * that saves and closes an inline editor on blur must not see a blur when
 * focus moves between those parts, or the editor closes under the person's
 * finger as they press the microphone. So `onFocus` fires when focus enters
 * the field and `onBlur` when it leaves it; moves inside are not reported.
 *
 * Focus can also go nowhere (`relatedTarget` null): a tap on empty page, a
 * button that takes no focus (Safari), a control the field itself removes or
 * disables while busy, or the window losing focus. Once focus has settled
 * the field decides: back inside, or the window switched away → still here; a
 * recent press inside → still here (the press was on the field); a recent
 * press outside → left. Until a later press or focus lands outside, the field
 * counts as focused, and the document listeners report the blur then.
 *
 * A blur while `busy` (a take is recorded or transcribed, or Improve is at
 * work) is held and reported once that has ended, which is after a take's
 * words were delivered, so a host that unmounts the field on blur never loses
 * what was said. A field unmounted while its blur is held reports none: the
 * words still reach `onValueChange`, the blur does not.
 */
export declare function useFieldFocus({ busy, onFocus, onBlur, }: {
    busy: boolean;
    onFocus?: () => void;
    onBlur?: () => void;
}): {
    wrapRef: import("react").RefObject<HTMLDivElement | null>;
    onFocus: () => void;
    onBlur: (e: ReactFocusEvent<HTMLDivElement>) => void;
};
//# sourceMappingURL=field-focus.d.ts.map