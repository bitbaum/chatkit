/**
 * Layout audits for a real browser — the part no unit test can see.
 *
 * Import this from a Playwright script, never from app code. `findBrokenWords`
 * runs INSIDE the page: it is self-contained on purpose (no imports, no
 * closures), so its source can be handed to `page.evaluate`:
 *
 *   import { BROKEN_WORDS_SOURCE } from "@bitbaum/chatkit/audit";
 *   const broken = await page.evaluate(`(${BROKEN_WORDS_SOURCE})(document.body)`);
 *   if (broken.length) throw new Error(`words cut across lines: ${broken}`);
 *
 * Why it exists: Substrata's answer table at 390px read "Te / rm" and
 * "Di / re / ct / or / y" (2026-10-22). Reading the CSS finds none of it; only
 * laying the words out does.
 */
/**
 * Every word under `root` that is drawn across two lines. A word may wrap onto
 * the next line; it may never be cut in two. Measured, not inferred: each word
 * is laid out in a `Range` and must sit on one line.
 *
 * Exempt, because a break there is legal: a word beside a hyphen, slash, dot,
 * at-sign, colon or underscore, and anything over `maxWord` characters (a URL
 * or an identifier has to break somewhere). Hidden text has no boxes and is
 * skipped. CJK scripts permit line breaks between characters; their wrapping
 * is not a broken word. Other scripts use Unicode word boundaries.
 */
export function findBrokenWords(root = document, options = {}) {
    const maxWord = options.maxWord ?? 24;
    const found = [];
    const near = /[-‐‑–—/_.@:]/;
    const characterWrapping = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
    const words = new Intl.Segmenter(undefined, { granularity: "word" });
    const walker = document.createTreeWalker(root instanceof Document ? root.body : root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = n.nodeValue ?? "";
        for (const { segment: word, index, isWordLike } of words.segment(text)) {
            if (!isWordLike || characterWrapping.test(word) || word.length > maxWord)
                continue;
            if (near.test(word) ||
                near.test(text[index - 1] ?? "") ||
                near.test(text[index + word.length] ?? ""))
                continue;
            const range = document.createRange();
            range.setStart(n, index);
            range.setEnd(n, index + word.length);
            const tops = Array.from(range.getClientRects())
                .filter((r) => r.width > 0)
                .map((r) => Math.round(r.top));
            if (tops.length > 1 && Math.max(...tops) - Math.min(...tops) > 6)
                found.push(word);
        }
    }
    return found;
}
/** `findBrokenWords` as source text, for `page.evaluate`. */
export const BROKEN_WORDS_SOURCE = findBrokenWords.toString();
//# sourceMappingURL=audit.js.map