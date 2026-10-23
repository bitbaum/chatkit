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
 * skipped.
 */
export declare function findBrokenWords(root?: ParentNode, options?: {
    maxWord?: number;
}): string[];
/** `findBrokenWords` as source text, for `page.evaluate`. */
export declare const BROKEN_WORDS_SOURCE: string;
//# sourceMappingURL=audit.d.ts.map