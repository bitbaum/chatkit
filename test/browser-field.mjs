// DictationField and CommentThread, checked in a real browser at phone width.
//
//   pnpm run demo && node test/browser-field.mjs
//
// What each check is for: a text box people type words into must have the
// microphone and 16px text (iOS zooms below it), every control must be a
// thumb's size, nothing may scroll sideways at 320px, a failed take or a
// failed "improve" must say so and keep the person's text, and a comment
// must post, list and be removable without a reload. On field-form.html: the
// submit keys a form needs, focus and blur for the whole field (the mic is not
// a blur; a blur during a take waits for the words), and an error that is
// seen in both themes and said in words.
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

  // ── a form's field: submit keys, field-level focus, the error state ──────
  // On demo/field-form.html: an inline editor (Note) that logs focus, blur
  // and submit, a one-line Title with a name and an error inside a native
  // <form>, and an "Elsewhere" button to take focus to.
  const formUrl = base.replace("field.html", "field-form.html");
  for (const [name, width, dark] of [
    ["form phone light", 390, false],
    ["form phone dark", 390, true],
    ["form desktop light", 1280, false],
    ["form desktop dark", 1280, true],
  ]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let delay = 0;
    await page.route("**/api/transcribe", async (route) => {
      await new Promise((r) => setTimeout(r, delay));
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ text: "said aloud" }),
      });
    });
    await page.goto(formUrl);
    if (dark) await page.evaluate(() => document.documentElement.classList.add("dark"));
    const note = page.locator("#note");
    const title = page.locator("#title");
    await note.waitFor();
    const logOf = () => page.evaluate(() => window.__log.slice());
    const count = async (prefix) => (await logOf()).filter((e) => e.startsWith(prefix)).length;
    const reset = () => page.evaluate(() => (window.__log.length = 0));

    // Submit keys in a multi-line field: Enter is a new line, Cmd/Ctrl+Enter submits.
    await note.click();
    check((await count("focus:note")) === 1, `${name}: focus entering the field is reported once`);
    await note.pressSequentially("hello");
    await note.press("Enter");
    check(
      (await count("submit:")) === 0 && (await note.inputValue()) === "hello\n",
      `${name}: Enter in a multi-line field is a new line, not a submit`,
    );
    await note.press("Control+Enter");
    await note.press("Meta+Enter");
    check((await count("submit:note")) === 2, `${name}: Ctrl+Enter and Cmd+Enter submit`);
    check(
      (await note.inputValue()) === "hello\n",
      `${name}: a submitting Enter adds no line break`,
    );
    await note.evaluate((el) =>
      el.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          ctrlKey: true,
          isComposing: true,
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    check(
      (await count("submit:note")) === 2,
      `${name}: an Enter ending an IME composition does not submit`,
    );
    await page.evaluate(() => (window.__suppressEnter = true));
    await note.press("Control+Enter");
    await page.evaluate(() => (window.__suppressEnter = false));
    check(
      (await count("submit:note")) === 2,
      `${name}: onKeyDown's preventDefault stops the submit`,
    );
    await note.press("Escape");
    check((await count("cancel:note")) === 1, `${name}: the app's onKeyDown sees every key`);

    // Field-level focus: the microphone and Improve are part of the field.
    await reset();
    const wrap = page.locator(".ck-field-wrap").first();
    await wrap.getByRole("button", { name: "Improve" }).click();
    await wrap.getByRole("button", { name: "Improve" }).click();
    await wrap.locator(".ck-mic").first().click();
    await page.locator(".ck-voice-confirm").first().waitFor({ timeout: 5000 });
    check((await count("blur:")) === 0, `${name}: pressing the microphone is not a blur`);
    await page.waitForTimeout(300);
    await page.locator(".ck-voice-confirm").first().click();
    await page
      .waitForFunction(() => document.querySelector("#note").value.includes("said aloud"), null, {
        timeout: 8000,
      })
      .catch(() => {});
    await page.waitForTimeout(100);
    check(
      (await note.inputValue()).includes("said aloud") && (await count("blur:")) === 0,
      `${name}: a whole take, pressed through to done, is not a blur (${await logOf()})`,
    );
    await note.click();
    await page.locator("#elsewhere").click();
    await page.waitForTimeout(100);
    check(
      (await count("blur:note")) === 1,
      `${name}: focus moving to another element is one blur (${await logOf()})`,
    );
    // A tap on empty page: focus goes nowhere (relatedTarget null), still a blur.
    await note.click();
    await page.mouse.click(4, 890);
    await page.waitForTimeout(100);
    check(
      (await count("blur:note")) === 2 && (await count("focus:note")) === 1,
      `${name}: a tap on empty page is one blur (${await logOf()})`,
    );

    // A blur during a take waits for the words.
    await reset();
    delay = 1200;
    await note.click();
    await wrap.locator(".ck-mic").first().click();
    await page.locator(".ck-voice-confirm").first().waitFor({ timeout: 5000 });
    await page.waitForTimeout(300);
    const before = await note.inputValue();
    await page.locator(".ck-voice-confirm").first().click();
    await page.locator("#elsewhere").click();
    await page.waitForTimeout(300);
    check(
      (await count("blur:")) === 0,
      `${name}: leaving while the take is transcribed holds the blur (${await logOf()})`,
    );
    await page
      .waitForFunction((b) => document.querySelector("#note").value.length > b.length, before, {
        timeout: 8000,
      })
      .catch(() => {});
    await page.waitForTimeout(100);
    const after = await note.inputValue();
    const blurs = (await logOf()).filter((e) => e.startsWith("blur:note:"));
    check(
      blurs.length === 1 && blurs[0] === `blur:note:${after}` && after.length > before.length,
      `${name}: the held blur comes once, after the words landed (${blurs})`,
    );
    delay = 0;

    // A one-line field: Enter submits, Shift+Enter and a composing Enter do not.
    await reset();
    await title.click();
    await title.press("Enter");
    check((await count("submit:title:")) === 1, `${name}: Enter submits a one-line field`);
    check((await count("native-submit")) === 0, `${name}: and the native form is not also sent`);
    const err = page.locator(".ck-field-error");
    await err.waitFor({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(300); // the frame's border-color transition
    const look = await page.evaluate(() => {
      const noteBox = document.querySelector("#note").closest(".ck-field");
      const titleBox = document.querySelector("#title").closest(".ck-field");
      const input = document.querySelector("#title");
      const error = document.querySelector(".ck-field-error");
      return {
        valid: getComputedStyle(noteBox).borderTopColor,
        invalid: getComputedStyle(titleBox).borderTopColor,
        ariaInvalid: input.getAttribute("aria-invalid"),
        describedBy: (input.getAttribute("aria-describedby") ?? "")
          .split(" ")
          .map((id) => document.getElementById(id)?.textContent ?? "(missing)"),
        role: error?.getAttribute("role"),
        text: error?.textContent ?? "",
        errorColour: error ? getComputedStyle(error).color : "",
        textColour: getComputedStyle(document.querySelector(".ck-field-label")).color,
      };
    });
    check(
      look.valid !== look.invalid,
      `${name}: the invalid frame is drawn in another colour (${look.invalid} vs ${look.valid})`,
    );
    check(
      look.text.includes("A title is needed") && look.role === "alert",
      `${name}: the error is said in words, as an alert`,
    );
    check(
      look.ariaInvalid === "true" &&
        look.describedBy.join("|") ===
          "A title is needed before this can be saved.|One line, said or typed.",
      `${name}: aria-invalid, and the error and hint describe the field (${look.describedBy})`,
    );
    await title.pressSequentially("My title");
    await title.press("Shift+Enter");
    check(
      (await count("submit:title:")) === 1,
      `${name}: Shift+Enter does not submit a one-line field`,
    );
    await title.evaluate((el) =>
      el.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          isComposing: true,
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    check((await count("submit:title:")) === 1, `${name}: a composing Enter does not submit`);
    await title.press("Enter");
    check(
      (await logOf()).includes("submit:title:My title"),
      `${name}: Enter submits the one-line field with its text`,
    );
    check(
      (await page.evaluate(() => new FormData(document.querySelector("#native")).get("title"))) ===
        "My title",
      `${name}: the field posts with its form under its name`,
    );
    check(
      (await page.locator(".ck-field-error").count()) === 0 &&
        (await title.getAttribute("aria-invalid")) === null,
      `${name}: the error goes once it is fixed`,
    );
    check(errors.length === 0, `${name}: no page errors ${errors.join(" | ")}`);
    await page.close();
  }

  // ── an error shown at phone widths: nothing small, nothing sideways ──────
  for (const [name, width, dark] of [
    ["error 390 light", 390, false],
    ["error 390 dark", 390, true],
    ["error 320 light", 320, false],
    ["error 320 dark", 320, true],
  ]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(formUrl);
    if (dark) await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.locator("#title").click();
    await page.locator("#title").press("Enter");
    await page
      .locator(".ck-field-error")
      .waitFor({ timeout: 2000 })
      .catch(() => {});
    const m = await page.evaluate(() => ({
      error: document.querySelector(".ck-field-error")?.getBoundingClientRect().height ?? 0,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      small: [...document.querySelectorAll(".ck-field-wrap button")]
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.width > 0 && (r.width < 44 || r.height < 44)).length,
      fontMin: Math.min(
        ...[...document.querySelectorAll(".ck-field-input")].map((e) =>
          parseFloat(getComputedStyle(e).fontSize),
        ),
      ),
    }));
    check(m.error > 0, `${name}: the error is shown`);
    check(m.overflow <= 0, `${name}: no horizontal scroll with an error (${m.overflow}px over)`);
    check(m.small === 0, `${name}: every control >= 44px with an error (${m.small} smaller)`);
    check(m.fontMin >= 16, `${name}: field text stays >= 16px (${m.fontMin}px)`);
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
