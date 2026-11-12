"use client";
import { useCallback, useEffect, useRef } from "react";
/** A press this recent explains a focus that went nowhere (iOS moves focus at the click). */
const PRESS_EXPLAINS_MS = 1000;
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
export function useFieldFocus({ busy, onFocus, onBlur, }) {
    const wrapRef = useRef(null);
    const inside = useRef(false);
    const held = useRef(false);
    const busyRef = useRef(busy);
    const lastPress = useRef(null);
    const callbacks = useRef({ onFocus, onBlur });
    // Before the busy effect below, so a held blur calls the host's handler
    // from the render that already has the delivered words.
    useEffect(() => {
        callbacks.current = { onFocus, onBlur };
    });
    const contains = useCallback((node) => typeof Node !== "undefined" && node instanceof Node && !!wrapRef.current?.contains(node), []);
    const leave = useCallback(() => {
        if (!inside.current)
            return;
        if (busyRef.current) {
            held.current = true;
            return;
        }
        inside.current = false;
        held.current = false;
        callbacks.current.onBlur?.();
    }, []);
    useEffect(() => {
        busyRef.current = busy;
        if (!busy && held.current)
            leave();
    }, [busy, leave]);
    const tracking = Boolean(onFocus || onBlur);
    useEffect(() => {
        if (!tracking)
            return;
        const onPointer = (e) => {
            const pressedInside = contains(e.target);
            lastPress.current = { inside: pressedInside, at: Date.now() };
            if (pressedInside) {
                // Back on the field before the take ended: nothing to report.
                held.current = false;
                return;
            }
            // Focused nowhere in the field (see above) and a press elsewhere: left.
            if (inside.current && !contains(document.activeElement))
                leave();
        };
        const onFocusIn = (e) => {
            if (!contains(e.target))
                leave();
        };
        document.addEventListener("pointerdown", onPointer, true);
        document.addEventListener("focusin", onFocusIn, true);
        return () => {
            document.removeEventListener("pointerdown", onPointer, true);
            document.removeEventListener("focusin", onFocusIn, true);
        };
    }, [tracking, contains, leave]);
    const handleFocus = useCallback(() => {
        held.current = false;
        if (inside.current)
            return;
        inside.current = true;
        callbacks.current.onFocus?.();
    }, []);
    const handleBlur = useCallback((e) => {
        const next = e.relatedTarget;
        if (next) {
            if (!contains(next))
                leave();
            return;
        }
        setTimeout(() => {
            if (!inside.current || !wrapRef.current)
                return;
            if (contains(document.activeElement))
                return;
            if (!document.hasFocus())
                return;
            const press = lastPress.current;
            if (press && Date.now() - press.at < PRESS_EXPLAINS_MS) {
                if (!press.inside)
                    leave();
                return;
            }
            // No press: focus fell off a control this field removed or disabled
            // while busy (a take, Improve at work). The person has not gone anywhere.
            if (busyRef.current)
                return;
            leave();
        }, 0);
    }, [contains, leave]);
    return { wrapRef, onFocus: handleFocus, onBlur: handleBlur };
}
//# sourceMappingURL=field-focus.js.map