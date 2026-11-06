// DictationField and CommentThread, checked in a real browser at phone width.
//
//   pnpm run demo && node test/browser-field.mjs
//
// What each check is for: a text box people type words into must have the
// microphone and 16px text (iOS zooms below it), every control must be a
// thumb's size, nothing may scroll sideways at 320px, a failed take or a
// failed "improve" must say so and keep the person's text, and a comment
// must post, list and be removable without a reload.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = createServer(async (req, res) => {
  const path = normalize(join(root, decodeURIComponent(new URL(req.url, "http://x").pathname)));
  if (!path.startsWith(root)) return res.writeHead(403).end();
  try {
    const body = await readFile(path);
    res
      .writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" })
      .end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const base = `http://localhost:${server.address().port}/demo/field.html`;

let failures = 0;
const check = (ok, what) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}`);
  if (!ok) failures++;
};

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
try {
  for (const [name, width, dark] of [
    ["phone", 390, false],
    ["narrow", 320, true],
    ["desktop", 1280, false],
  ]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/transcribe", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ text: "said aloud" }),
      }),
    );
    await page.goto(base);
    if (dark) await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.waitForSelector(".ck-field-input");

    const m = await page.evaluate(() => {
      const fields = [...document.querySelectorAll(".ck-field")];
      const small = [
        ...document.querySelectorAll(
          ".ck-icon-btn, .ck-field-improve, .ck-comment-signin-link, .ck-send",
        ),
      ]
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.width > 0 && (r.width < 44 || r.height < 44)).length;
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        fields: fields.length,
        mics: document.querySelectorAll(".ck-field .ck-mic").length,
        fontMin: Math.min(
          ...[...document.querySelectorAll(".ck-field-input, .ck-comment-body, .ck-input")].map(
            (e) => parseFloat(getComputedStyle(e).fontSize),
          ),
        ),
        small,
        labels: [...document.querySelectorAll("label.ck-field-label")].map((l) => l.textContent),
        commentMics: document.querySelectorAll(".ck-comment-box .ck-mic").length,
        signIn: document.querySelector(".ck-comment-signin-link")?.getAttribute("href"),
      };
    });
    check(m.overflow <= 0, `${name}: no horizontal scroll (${m.overflow}px over)`);
    check(
      m.fields === 2 && m.mics === 2,
      `${name}: a microphone in every field (${m.mics}/${m.fields})`,
    );
    check(m.commentMics === 1, `${name}: the comment box has the microphone too`);
    check(m.fontMin >= 16, `${name}: field and comment text >= 16px (${m.fontMin}px)`);
    check(m.small === 0, `${name}: every control >= 44px (${m.small} smaller)`);
    check(m.labels.join() === "Title,Note", `${name}: fields are labelled (${m.labels})`);
    check(m.signIn === "/sign-in", `${name}: a signed-out reader is shown the way to sign in`);
    check(errors.length === 0, `${name}: no page errors ${errors.join(" | ")}`);
    await page.close();
  }

  // ── the mic puts words in the field, appending to what is there ──────────
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await page.route("**/api/transcribe", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ text: "said aloud" }),
      }),
    );
    await page.goto(base);
    const note = page.locator("#field-fixture .ck-field-wrap").nth(1);
    await note.locator("textarea.ck-field-input").fill("Typed first.");
    // Headless Chromium has a recogniser with no speech service behind it, so
    // the press records and posts the audio (the chatkit mic contract).
    await note.locator(".ck-mic").click();
    await page.locator(".ck-voice-confirm").first().waitFor({ timeout: 5000 });
    await page.waitForTimeout(400);
    await page.locator(".ck-voice-confirm").first().click();
    await page
      .waitForFunction(
        () => document.querySelectorAll(".ck-field-input")[1].value.includes("said aloud"),
        null,
        { timeout: 8000 },
      )
      .catch(() => {});
    check(
      (await note.locator("textarea.ck-field-input").inputValue()) === "Typed first. said aloud",
      "mic: the words are appended to what was typed",
    );

    // ── improve: a suggestion runs in one tap, Undo puts the text back ─────
    await note.getByRole("button", { name: "Improve" }).click();
    check(
      (await note.locator(".ck-field-suggestion").count()) === 2,
      "improve: the suggestions are offered as buttons",
    );
    const cols = await note
      .locator(".ck-field-suggestions")
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    check(
      cols === 2,
      `improve: suggestions are an even grid (${cols} columns), not wrapping pills`,
    );
    await note.getByRole("button", { name: "Make it tighter" }).click();
    await page
      .waitForFunction(
        () => document.querySelectorAll(".ck-field-input")[1].value.includes("[Make it tighter]"),
        null,
        { timeout: 5000 },
      )
      .catch(() => {});
    check(
      (await note.locator("textarea.ck-field-input").inputValue()) ===
        "Typed first. said aloud [Make it tighter]",
      "improve: the text is replaced by the improved one",
    );
    check((await note.locator(".ck-field-undo").count()) === 1, "improve: Undo is offered");
    await note.getByRole("button", { name: "Undo" }).click();
    check(
      (await note.locator("textarea.ck-field-input").inputValue()) === "Typed first. said aloud",
      "improve: Undo puts the previous text back",
    );

    // ── improve fails: said in words, text kept, the way forward stays ─────
    await note.getByRole("button", { name: "Improve" }).click();
    await note.getByLabel("What should change?").fill("make it fail");
    await note.getByRole("button", { name: "Change it" }).click();
    await note.locator('.ck-problem[role="alert"]').waitFor({ timeout: 5000 });
    check(
      (await note.locator("textarea.ck-field-input").inputValue()) === "Typed first. said aloud",
      "improve failure: the person's text is unchanged",
    );
    check(
      (await note.getByRole("button", { name: "Change it" }).isEnabled()) === false ||
        (await note.getByLabel("What should change?").inputValue()) === "make it fail",
      "improve failure: the instruction is kept, so it can be retried",
    );
    await page.close();
  }

  // ── comments: post, list, remove; a refused post keeps the draft ─────────
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await page.goto(base);
    const thread = page.locator(".ck-comments").first();
    check(
      (await thread.locator(".ck-comments-title").innerText()) === "2 comments",
      "comments: the count reads '2 comments'",
    );
    check(
      (await thread.locator(".ck-comment-remove").count()) === 0,
      "comments: nobody gets a Remove on comments that are not theirs",
    );
    await thread.locator(".ck-input").fill("my turn");
    await thread.getByRole("button", { name: "Comment", exact: true }).click();
    await page
      .waitForFunction(
        () => document.querySelector(".ck-comments-title")?.textContent === "3 comments",
        null,
        { timeout: 5000 },
      )
      .catch(() => {});
    check(
      (await thread.locator(".ck-comments-title").innerText()) === "3 comments",
      "comments: a posted comment is listed at once",
    );
    check(
      (await thread.locator(".ck-input").inputValue()) === "",
      "comments: the box is cleared after a post",
    );
    check(
      (await thread.locator(".ck-comment-remove").count()) === 1,
      "comments: your own comment can be removed",
    );
    await thread.locator(".ck-comment-remove").click();
    await page
      .waitForFunction(
        () => document.querySelector(".ck-comments-title")?.textContent === "2 comments",
        null,
        { timeout: 5000 },
      )
      .catch(() => {});
    check(
      (await thread.locator(".ck-comments-title").innerText()) === "2 comments",
      "comments: removing takes it off the list",
    );
    await thread.locator(".ck-input").fill("boom");
    await thread.getByRole("button", { name: "Comment", exact: true }).click();
    await thread.locator('.ck-problem[role="alert"]').waitFor({ timeout: 5000 });
    check(
      (await thread.locator(".ck-input").inputValue()) === "boom",
      "comments: a refused post keeps the draft in the box",
    );
    const text = await thread.innerText();
    check(
      text.includes("A longer one") && !text.includes("<"),
      "comments: line breaks and text are shown as text",
    );
    const empty = page.locator(".ck-comments").nth(1);
    check(
      (await empty.locator(".ck-comments-title").innerText()) === "No comments yet",
      "comments: an empty thread says so",
    );
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (failures) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log("all field and comment checks passed");
