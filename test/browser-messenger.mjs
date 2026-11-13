// The Messenger in a real browser, at a phone's width and a desktop's.
//
//   pnpm run demo && node test/browser-messenger.mjs
//
// Drives demo/messenger.html (a pretend backend) through what a person does:
// open a conversation, write, call the agent in, send a photo, read back up
// a long thread, edit, start a new conversation. And the things the eye
// checks that no unit test can: the box sits at the bottom of the screen
// with nothing empty under it, the thread fills what is left, nothing scrolls
// sideways, every control is a 44px target, no word is cut across lines, the
// text is 16px, and an agent's message can be told from a person's.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { BROKEN_WORDS_SOURCE } from "../dist/audit.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
};
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
const base = `http://localhost:${server.address().port}/demo/messenger.html`;

let failures = 0;
const check = (ok, what) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}`);
  if (!ok) failures++;
};

// A 2×2 PNG: a photo, as far as the box can tell.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEIGBkZGRgYAAA0BgMBCcLDvQAAAABJRU5ErkJggg==",
  "base64",
);

/** Layout facts the eye checks: sideways scroll, small targets, cut words. */
async function layout(page) {
  return page.evaluate(`(() => {
    const small = [...document.querySelectorAll(
      ".ck-msgr button, .ck-msgr a[href], .ck-msgr input:not([type=file]), .ck-msgr textarea"
    )]
      .filter((e) => !e.closest("dialog:not([open])") && !e.closest("[hidden]"))
      .map((e) => [e, e.getBoundingClientRect()])
      .filter(([, r]) => r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44))
      // The remove dot on a staged file extends its target with ::after, and
      // a link inside a sentence is text, not a control.
      .filter(([e]) => !e.classList.contains("ck-attach-remove") && !e.classList.contains("ck-msgr-link") && !e.closest(".ck-md"))
      // The search field's box is the 44px target; the input inside fills it.
      .filter(([e]) => !e.closest(".ck-msgr-search"))
      .map(([e, r]) => (e.getAttribute("aria-label") || e.className || e.tagName) + " " + Math.round(r.width) + "x" + Math.round(r.height));
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      small,
      broken: (${BROKEN_WORDS_SOURCE})(document.body),
    };
  })()`);
}

/** Where the parts of an open conversation sit, in CSS pixels. */
async function frame(page) {
  return page.evaluate(() => {
    const box = (sel) => document.querySelector(sel)?.getBoundingClientRect();
    const top = box(".ck-msgr-top");
    const wrap = box(".ck-msgr-thread-wrap");
    const dock = box(".ck-msgr-dock");
    return {
      height: window.innerHeight,
      top: top && { y: Math.round(top.top), bottom: Math.round(top.bottom) },
      wrap: wrap && { y: Math.round(wrap.top), bottom: Math.round(wrap.bottom) },
      dock: dock && { y: Math.round(dock.top), bottom: Math.round(dock.bottom) },
      pageScroll: document.documentElement.scrollHeight - window.innerHeight,
    };
  });
}

const bubbles = (page) =>
  page.$$eval(".ck-msgr-bubble", (els) => els.map((e) => e.textContent ?? ""));
const count = (page, text) => bubbles(page).then((all) => all.filter((b) => b === text).length);
const atEnd = (page) =>
  page.$eval(".ck-msgr-scroll", (el) => el.scrollHeight - el.scrollTop - el.clientHeight < 4);

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
try {
  // ── the screen, at every width, light and dark ──
  for (const [name, width, height, dark] of [
    ["phone", 390, 844, false],
    ["small phone, dark", 320, 640, true],
    ["desktop", 1280, 800, false],
  ]) {
    const phone = width < 768;
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: phone,
      isMobile: phone,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    if (dark) await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.waitForSelector(".ck-msgr-row");

    let m = await layout(page);
    check(m.overflow <= 0, `${name}: the list does not scroll sideways (${m.overflow}px)`);
    check(
      m.small.length === 0,
      `${name}: every control in the list is 44px (${m.small.join(", ")})`,
    );
    check(m.broken.length === 0, `${name}: no word in the list is cut (${m.broken.join(", ")})`);
    check(
      (await page.locator(".ck-msgr-row").count()) === 5,
      `${name}: five conversations are listed`,
    );
    check(
      (await page.locator(".ck-msgr-row").first().locator(".ck-msgr-row-name").textContent()) ===
        "Maya Keller",
      `${name}: the newest conversation is first`,
    );
    check(
      (await page.locator(".ck-msgr-badge").textContent()) === "2",
      `${name}: an unread conversation shows its count`,
    );
    check(
      (await page.locator(".ck-msgr-row-agent").count()) === 1,
      `${name}: the conversation an agent joined says so on its face`,
    );
    check(
      (await page.locator(".ck-msgr-main").isVisible()) === !phone,
      `${name}: ${phone ? "one pane at a time" : "list and conversation side by side"}`,
    );

    // Open the conversation the agent joined.
    await page.locator(".ck-msgr-row").first().click();
    await page.waitForSelector(".ck-msgr-bubble");
    check(
      (await page.locator(".ck-msgr-side").isVisible()) === !phone,
      `${name}: opening a conversation ${phone ? "replaces the list" : "keeps the list beside it"}`,
    );
    check(
      (await page.locator(".ck-msgr-back").isVisible()) === phone,
      `${name}: ${phone ? "a way back to the list" : "no back button beside the list"}`,
    );

    const f = await frame(page);
    check(f.pageScroll <= 0, `${name}: the page itself does not scroll (${f.pageScroll}px)`);
    check(f.top.y === 0, `${name}: the conversation's top bar is at the top (${f.top.y})`);
    check(
      Math.abs(f.dock.bottom - f.height) <= 1,
      `${name}: the box sits at the bottom of the screen, nothing empty under it (${f.height - f.dock.bottom}px)`,
    );
    check(
      f.wrap.y === f.top.bottom && Math.abs(f.wrap.bottom - f.dock.y) <= 1,
      `${name}: the thread fills everything between the top bar and the box`,
    );
    const chrome = f.top.bottom - f.top.y + (f.dock.bottom - f.dock.y);
    check(
      chrome <= 132,
      `${name}: top bar and box together leave the screen to the conversation (${chrome}px of ${f.height})`,
    );
    check(await atEnd(page), `${name}: the conversation opens at its newest message`);

    m = await layout(page);
    check(m.overflow <= 0, `${name}: the conversation does not scroll sideways (${m.overflow}px)`);
    check(m.small.length === 0, `${name}: every control is 44px (${m.small.join(", ")})`);
    check(m.broken.length === 0, `${name}: no word is cut (${m.broken.join(", ")})`);

    const sizes = await page.evaluate(() => ({
      bubble: parseFloat(getComputedStyle(document.querySelector(".ck-msgr-bubble")).fontSize),
      input: parseFloat(getComputedStyle(document.querySelector(".ck-input")).fontSize),
    }));
    check(sizes.bubble >= 16 && sizes.input >= 16, `${name}: messages and the box are 16px`);
    check((await page.locator(".ck-mic").count()) === 1, `${name}: the box has a microphone`);
    const row = await page.evaluate(() => {
      const y = (sel) => Math.round(document.querySelector(sel).getBoundingClientRect().top);
      return [y(".ck-composer .ck-tools .ck-icon-btn"), y(".ck-mic"), y(".ck-send")];
    });
    check(
      Math.max(...row) - Math.min(...row) <= 2,
      `${name}: attach, microphone and send are one row (${row.join("/")})`,
    );

    // Who is a person and who is not.
    const agentRun = page.locator(".ck-msgr-from-agent").first();
    check(
      (await agentRun.locator(".ck-speaker-kind").textContent()) === "Agent",
      `${name}: the agent's message is marked Agent`,
    );
    check(
      /for Georgy/.test((await agentRun.locator(".ck-speaker").textContent()) ?? ""),
      `${name}: and says whom it answered for`,
    );
    const looks = await page.evaluate(() => {
      const style = (sel) => getComputedStyle(document.querySelector(sel));
      const agent = style(".ck-msgr-from-agent .ck-msgr-bubble");
      const other = style(".ck-msgr-other:not(.ck-msgr-from-agent) .ck-msgr-bubble");
      const own = style(".ck-msgr-own .ck-msgr-bubble");
      return {
        agentBg: agent.backgroundColor,
        agentBorder: agent.borderTopWidth,
        otherBg: other.backgroundColor,
        ownBg: own.backgroundColor,
        agentFace: style(".ck-msgr-from-agent .ck-msgr-avatar").borderTopLeftRadius,
        personFace: style(".ck-msgr-other:not(.ck-msgr-from-agent) .ck-msgr-avatar")
          .borderTopLeftRadius,
      };
    });
    check(
      looks.agentBg !== looks.otherBg &&
        looks.agentBorder === "1px" &&
        looks.ownBg !== looks.otherBg,
      `${name}: an agent's bubble, a person's and the viewer's are three different bubbles`,
    );
    check(
      looks.agentFace !== looks.personFace,
      `${name}: an agent's face is a different shape from a person's`,
    );
    check(
      (await page.locator(".ck-msgr-other:not(.ck-msgr-from-agent) .ck-speaker-kind").count()) ===
        0,
      `${name}: no person is marked as an agent`,
    );
    check(
      /Cat is in this conversation/.test(
        (await page.locator(".ck-msgr-top-sub").textContent()) ?? "",
      ),
      `${name}: the top bar says an agent is in the conversation`,
    );
    check(
      (await page.locator(".ck-msgr-own .ck-msgr-tick-read").count()) > 0,
      `${name}: a message the other person read shows it`,
    );
    check(
      (await page.locator(".ck-msgr-link").getAttribute("href")) ===
        "https://example.org/penguins-are-birds",
      `${name}: an address in a message is a link, without the full stop after it`,
    );

    // Write. The message is shown once, the box is emptied, the thread follows.
    await page.fill(".ck-input", "Speaking of birds");
    await page.click(".ck-send");
    await page.waitForFunction(
      () => window.ckMessenger.calls.send === 1 && !document.querySelector(".ck-msgr-sending"),
    );
    check((await count(page, "Speaking of birds")) === 1, `${name}: a sent message is shown once`);
    check((await page.inputValue(".ck-input")) === "", `${name}: the box is emptied`);
    check(await atEnd(page), `${name}: the thread follows what was sent`);

    // Call the agent in.
    await page.fill(".ck-input", "@cat who is right?");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".ck-msgr-awaited");
    check(
      /Cat is thinking/.test((await page.locator(".ck-msgr-awaited").textContent()) ?? ""),
      `${name}: naming the agent shows that it is thinking`,
    );
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".ck-msgr-from-agent .ck-msgr-bubble")].some((b) =>
        b.textContent.includes("you are right about the"),
      ),
    );
    check(
      (await page.locator(".ck-msgr-awaited").count()) === 0,
      `${name}: its answer ends the wait`,
    );
    check(
      (await page.locator(".ck-msgr-from-agent .ck-msgr-bubble strong").last().textContent()) ===
        "birds",
      `${name}: the agent's answer is rendered as markdown`,
    );
    check(await atEnd(page), `${name}: the thread follows the agent's answer`);

    // Somebody else, elsewhere and here.
    await page.evaluate(() =>
      window.ckMessenger.emit({
        type: "message",
        message: {
          id: "push-1",
          threadId: "ben",
          authorId: "ben",
          body: "Friday?",
          createdAt: new Date(),
        },
      }),
    );
    if (phone) {
      await page.click(".ck-msgr-back");
      await page.waitForSelector(".ck-msgr-row");
    }
    check(
      (await page.locator(".ck-msgr-badge").textContent()) === "3",
      `${name}: a message in another conversation raises its count`,
    );
    check(
      (await page.locator(".ck-msgr-row").first().locator(".ck-msgr-row-name").textContent()) ===
        "Ben Ito",
      `${name}: and brings it to the top of the list`,
    );
    await page.locator(".ck-msgr-row", { hasText: "Ben Ito" }).click();
    // Side by side, the conversation that was open may still be on screen with
    // a "New" line of its own: wait for THIS one before reading the thread.
    await page.waitForFunction(
      () => document.querySelector(".ck-msgr-top-name")?.textContent?.includes("Ben Ito") === true,
    );
    await page.waitForSelector(".ck-msgr-unread-line");
    check(
      (await page.locator(".ck-msgr-unread-line").textContent()) === "New",
      `${name}: an unread conversation opens with a line where the new messages begin`,
    );
    check(
      (await page.locator(".ck-speaker").count()) === 0,
      `${name}: between two people nobody is named`,
    );
    await page.waitForFunction(() => !document.querySelector(".ck-msgr-badge"));
    check(true, `${name}: reading it clears its count`);
    // Debounced: a burst of read marks is one request.
    await page.waitForFunction(() => window.ckMessenger.calls.markRead >= 1);
    check(true, `${name}: and the read mark is sent`);
    await page.evaluate(() =>
      window.ckMessenger.emit({
        type: "typing",
        conversationId: "ben",
        actorId: "ben",
        typing: true,
      }),
    );
    await page.waitForSelector(".ck-msgr-typing");
    check(
      /Ben Ito is typing/.test((await page.locator(".ck-msgr-typing").textContent()) ?? ""),
      `${name}: somebody typing is shown by name`,
    );
    await page.evaluate(() =>
      window.ckMessenger.emit({
        type: "message",
        message: {
          id: "push-2",
          threadId: "ben",
          authorId: "ben",
          body: "Or Saturday.",
          createdAt: new Date(),
        },
      }),
    );
    await page.waitForFunction(() => !document.querySelector(".ck-msgr-typing"));
    check(
      (await count(page, "Or Saturday.")) === 1,
      `${name}: their message arrives and the dots go`,
    );

    check(errors.length === 0, `${name}: no page errors (${errors.join("; ")})`);
    await context.close();
  }

  // ── a phone: photos, a long thread, editing, a new conversation ──
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // The attach sheet, and a photo on its way.
    await page.goto(`${base}?open=hike`);
    await page.waitForSelector(".ck-msgr-bubble");
    await page.tap(".ck-composer .ck-tools .ck-icon-btn");
    await page.waitForSelector(".ck-sheet[open]");
    const sources = await page.$$eval(".ck-sheet[open] .ck-attach-source", (els) =>
      els.map((e) => e.textContent),
    );
    check(
      sources.join(",") === "Camera,Photos,Videos,Files",
      `attach: the sheet offers Camera, Photos, Videos, Files (${sources.join(",")})`,
    );
    const cells = await page.$$eval(".ck-sheet[open] .ck-attach-source", (els) =>
      els.map((e) => Math.round(e.getBoundingClientRect().width)),
    );
    check(
      Math.max(...cells) - Math.min(...cells) <= 1,
      `attach: four equal cells in one row (${cells.join("/")})`,
    );
    check(
      (await page.locator(".ck-sheet[open] .ck-attach-extra").last().textContent())?.includes(
        "Ask Cat",
      ),
      "attach: the same sheet offers to ask the agent",
    );
    check(
      (await page.locator(".ck-sheet[open] .ck-attach-extra").count()) === 1,
      "actions: an action that does not fit a conversation is not offered in it",
    );
    await page.locator(".ck-sheet[open] .ck-sheet-close").click();

    await page.setInputFiles('input[data-ck-source="photos"]', {
      name: "ridge.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await page.waitForSelector(".ck-msgr-upload");
    check(
      (await page.locator(".ck-msgr-upload-bar").count()) === 1 ||
        (await page.locator('.ck-msgr-upload[data-upload="done"]').count()) === 1,
      "upload: a photo on its way shows its progress",
    );
    await page.waitForSelector('.ck-msgr-upload[data-upload="done"]');
    check(
      !(await page.locator(".ck-send").isDisabled()),
      "upload: a photo alone, with no words, can be sent",
    );
    const before = await page.locator(".ck-msgr-media").count();
    await page.tap(".ck-send");
    await page.waitForFunction(
      (n) =>
        document.querySelectorAll(".ck-msgr-media").length === n + 1 &&
        !document.querySelector(".ck-msgr-sending"),
      before,
    );
    check((await page.locator(".ck-msgr-upload").count()) === 0, "upload: the tray is cleared");
    check(
      (await page.evaluate(() => window.ckMessenger.calls.upload)) === 1,
      "upload: the bytes went through the app's transport once",
    );
    check(await atEnd(page), "upload: the thread follows the photo");
    let m = await layout(page);
    check(m.overflow <= 0, `upload: nothing scrolls sideways (${m.overflow}px)`);

    // A type the policy does not take is refused in words, before any upload.
    await page.setInputFiles('input[data-ck-source="files"]', {
      name: "page.html",
      mimeType: "text/html",
      buffer: Buffer.from("<script>alert(1)</script>"),
    });
    await page.waitForSelector(".ck-msgr-dock .ck-note");
    check(
      (await page.locator(".ck-msgr-dock .ck-note").textContent()) ===
        "page.html cannot be sent here.",
      "upload: a type that is not accepted is refused in words",
    );
    check(
      (await page.evaluate(() => window.ckMessenger.calls.upload)) === 1,
      "upload: and nothing was uploaded for it",
    );

    // The viewer: a picture, the whole screen, and back.
    await page.locator(".ck-msgr-media").last().click();
    await page.waitForSelector(".ck-msgr-viewer[open] img");
    const viewer = await page.$eval(".ck-msgr-viewer[open]", (d) => {
      const r = d.getBoundingClientRect();
      return [Math.round(r.width), Math.round(r.height)];
    });
    check(viewer[0] === 390 && viewer[1] === 844, "viewer: a picture opens on the whole screen");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".ck-msgr-viewer"));
    check(true, "viewer: Escape closes it");

    // ── replies, reactions, cards ──
    await page.goto(`${base}?open=maya`);
    await page.waitForSelector(".ck-msgr-quote");
    check(
      (await page.locator(".ck-msgr-quote").first().textContent())?.includes(
        "Fine. But they swim better",
      ),
      "reply: a reply shows the message it answers",
    );
    await page.locator(".ck-msgr-quote").first().tap();
    await page.waitForSelector(".ck-msgr-found");
    check(true, "reply: tapping the quote leads to that message and marks it");
    m = await layout(page);
    check(m.overflow <= 0, `reply: nothing scrolls sideways (${m.overflow}px)`);
    check(m.small.length === 0, `reply: every control is 44px (${m.small.join(", ")})`);

    const card = page.locator(".ck-msgr-card").first();
    check(
      (await card.locator(".ck-msgr-card-amount").textContent()) === "CHF 12.00",
      "card: a payment request shows its amount",
    );
    check(
      (await card.locator(".ck-msgr-card-action").textContent()) === "Pay CHF 12.00",
      "card: and what this reader can do about it",
    );

    // A long press: react, then reply.
    const bubble = page.locator(".ck-msgr-other .ck-msgr-bubble").last();
    await bubble.dispatchEvent("contextmenu");
    await page.waitForSelector(".ck-sheet[open] .ck-msgr-react");
    const reacts = await page.$$eval(".ck-sheet[open] .ck-msgr-react", (els) =>
      els.map((e) => Math.round(e.getBoundingClientRect().height)),
    );
    check(
      reacts.length === 6 && Math.min(...reacts) >= 44,
      `react: six emoji in one row, each 44px (${reacts.join("/")})`,
    );
    await page.locator(".ck-sheet[open] .ck-msgr-react").nth(1).tap();
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".ck-msgr-reaction")].some(
        (e) => e.textContent === "❤️" && e.getAttribute("aria-pressed") === "true",
      ),
    );
    check(
      (await page.evaluate(() => window.ckMessenger.calls.react)) === 1,
      "react: the emoji is on the message at once and the server is told once",
    );
    await page.locator('.ck-msgr-reaction[aria-pressed="true"]').tap();
    await page.waitForFunction(
      () => !document.querySelector('.ck-msgr-reaction[aria-pressed="true"]'),
    );
    check(true, "react: tapping your own chip takes it off");

    await bubble.dispatchEvent("contextmenu");
    await page.waitForSelector(".ck-sheet[open] .ck-attach-extra");
    await page.locator(".ck-sheet[open] .ck-attach-extra", { hasText: "Reply" }).tap();
    await page.waitForSelector(".ck-msgr-replying");
    await page.fill(".ck-input", "Answering that one");
    await page.tap(".ck-send");
    await page.waitForFunction(
      () =>
        !document.querySelector(".ck-msgr-sending") &&
        [...document.querySelectorAll(".ck-msgr-own .ck-msgr-msg")].some(
          (e) => e.querySelector(".ck-msgr-quote") && e.textContent.includes("Answering that one"),
        ),
    );
    check(
      (await page.locator(".ck-msgr-replying").count()) === 0,
      "reply: the sent message carries its quote, and the box forgets it",
    );
    check(
      await page.evaluate(() => {
        const sent = window.ckMessenger.store.maya.at(-1);
        return Boolean(sent.replyTo && sent.replyTo.id);
      }),
      "reply: the server is told which message was answered",
    );

    // An app's action: ask for money.
    await page.tap(".ck-composer .ck-tools .ck-icon-btn");
    await page.locator(".ck-sheet[open] .ck-attach-extra", { hasText: "Request money" }).tap();
    await page.waitForSelector(".ck-sheet[open] .ck-msgr-amount");
    await page.locator(".ck-sheet[open] .ck-msgr-btn-primary").tap();
    check(
      (await page.locator(".ck-msgr-amount-error").count()) === 1,
      "actions: no amount, no request — and the sheet says so",
    );
    await page.fill(".ck-msgr-amount-box input", "7,5");
    m = await layout(page);
    check(m.small.length === 0, `actions: every control is 44px (${m.small.join(", ")})`);
    await page.locator(".ck-sheet[open] .ck-msgr-btn-primary").tap();
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".ck-msgr-own .ck-msgr-card-amount")].some(
        (e) => e.textContent === "CHF 7.50",
      ),
    );
    check(true, "actions: a comma is a decimal point, and the card is in the thread");

    // A failed upload keeps its tile, with a way to try again.
    await page.goto(`${base}?open=hike&fail=upload`);
    await page.waitForSelector(".ck-msgr-bubble");
    await page.setInputFiles('input[data-ck-source="photos"]', {
      name: "lake.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await page.waitForSelector('.ck-msgr-upload[data-upload="failed"]');
    check(
      (await page.locator(".ck-msgr-upload-retry").count()) === 1,
      "upload: a failed upload stays, with Try again",
    );
    check(
      /lake\.png could not be uploaded/.test(
        (await page.locator(".ck-msgr-dock .ck-note").textContent()) ?? "",
      ),
      "upload: and says so in words",
    );
    check(
      await page.locator(".ck-send").isDisabled(),
      "upload: nothing can be sent with only a failed file",
    );

    // A send that fails keeps the message, with Try again.
    await page.goto(`${base}?open=maya&fail=send`);
    await page.waitForSelector(".ck-msgr-bubble");
    await page.fill(".ck-input", "Is anyone there?");
    await page.tap(".ck-send");
    await page.waitForSelector(".ck-msgr-failed-row");
    check(
      /Not sent\./.test((await page.locator(".ck-msgr-failed-row").textContent()) ?? ""),
      "send: a message that did not go is kept and says so",
    );
    await page.locator(".ck-msgr-failed-row button", { hasText: "Try again" }).tap();
    await page.waitForFunction(() => window.ckMessenger.calls.send === 2);
    check(
      (await count(page, "Is anyone there?")) === 1,
      "send: Try again sends the same message, not a second one",
    );
    m = await layout(page);
    check(
      m.small.length === 0,
      `send: Try again and Delete are 44px targets (${m.small.join(", ")})`,
    );

    // An agent that never answers is said to be silent, not left "thinking".
    await page.goto(`${base}?open=maya&agent=quiet&patience=400`);
    await page.waitForSelector(".ck-msgr-bubble");
    await page.fill(".ck-input", "@cat hello?");
    await page.tap(".ck-send");
    await page.waitForFunction(() =>
      document.querySelector(".ck-msgr-awaited")?.textContent.includes("has not answered"),
    );
    await page.locator(".ck-msgr-awaited button").tap();
    await page.waitForFunction(() => !document.querySelector(".ck-msgr-awaited"));
    check(true, "agent: one that stays silent is said to be silent, and the note can be dismissed");

    // A long thread: opens at the end, loads earlier messages at the top,
    // and the reader's place is kept.
    await page.goto(`${base}?open=long`);
    await page.waitForSelector(".ck-msgr-bubble");
    check(await atEnd(page), "long: the thread opens at its newest message");
    check((await page.locator(".ck-msgr-bubble").count()) === 30, "long: one page is loaded");
    const first = await page.locator(".ck-msgr-bubble").first().textContent();
    // A real wheel, as a reader scrolls: a scripted scrollTo is not a person
    // leaving the end of the thread, and the thread would rightly follow on.
    // Up to the top and no further, so what happens next is the loading.
    await page.mouse.move(195, 400);
    const loaded = () => page.locator(".ck-msgr-bubble").count();
    for (let i = 0; i < 40 && (await loaded()) === 30; i++) {
      if ((await page.$eval(".ck-msgr-scroll", (el) => el.scrollTop)) <= 0) break;
      await page.mouse.wheel(0, -300);
      await page.waitForTimeout(20);
    }
    // The wheel stops here: what moves the thread from now on is the page of
    // history arriving, not the reader.
    await page.waitForFunction(() => document.querySelectorAll(".ck-msgr-bubble").length >= 60);
    check((await loaded()) === 60, "long: reaching the top loads the page before it, once");
    const kept = await page.evaluate((text) => {
      const scroller = document.querySelector(".ck-msgr-scroll").getBoundingClientRect();
      const bubble = [...document.querySelectorAll(".ck-msgr-bubble")].find(
        (b) => b.textContent === text,
      );
      const r = bubble.getBoundingClientRect();
      // The message that was at the top is still near the top: the page of
      // history went in above it, not under the reader's eyes.
      return r.top >= scroller.top - 4 && r.top < scroller.top + 240;
    }, first);
    check(kept, "long: earlier messages load above, and what was being read stays in view");
    check(
      (await page.locator(".ck-jump").count()) === 1,
      "long: away from the end, a button leads back to the newest message",
    );
    await page.evaluate(() =>
      window.ckMessenger.emit({
        type: "message",
        message: {
          id: "push-9",
          threadId: "long",
          authorId: "zoe",
          body: "Still here?",
          createdAt: new Date(),
        },
      }),
    );
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".ck-msgr-bubble")].some(
        (b) => b.textContent === "Still here?",
      ),
    );
    check(
      !(await atEnd(page)),
      "long: a message arriving does not pull the reader away from what they read",
    );
    await page.locator(".ck-jump").tap();
    await page.waitForFunction(() => !document.querySelector(".ck-jump"));
    check(await atEnd(page), "long: the button goes to the newest message");

    // Edit: the words go back into the box, and the bubble says it was edited.
    await page.goto(`${base}?open=maya`);
    await page.waitForSelector(".ck-msgr-bubble");
    await page.locator(".ck-msgr-own .ck-msgr-msg").last().dispatchEvent("contextmenu");
    await page.waitForSelector(".ck-sheet[open] .ck-attach-extra");
    const actions = await page.$$eval(".ck-sheet[open] .ck-attach-extra-text", (els) =>
      els.map((e) => e.textContent),
    );
    check(
      actions.join(",") === "Reply,Copy text,Edit,Delete",
      `actions: a message of the viewer's offers Reply, Copy, Edit, Delete (${actions.join(",")})`,
    );
    await page.locator(".ck-sheet[open] .ck-attach-extra", { hasText: "Edit" }).tap();
    await page.waitForSelector(".ck-msgr-editing");
    check(
      (await page.inputValue(".ck-input")) === "That we agree on.",
      "edit: the message is in the box",
    );
    await page.fill(".ck-input", "That much we agree on.");
    await page.tap(".ck-send");
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".ck-msgr-bubble")].some(
        (b) => b.textContent === "That much we agree on.",
      ),
    );
    check(
      (await count(page, "That we agree on.")) === 0,
      "edit: the bubble is changed, not added to",
    );
    check(
      /edited/.test((await page.locator(".ck-msgr-own .ck-msgr-meta").last().textContent()) ?? ""),
      "edit: and says it was edited",
    );
    await page.waitForFunction(() => !document.querySelector(".ck-msgr-editing"));
    check((await page.inputValue(".ck-input")) === "", "edit: the box is back to writing, empty");
    await page.locator(".ck-msgr-other .ck-msgr-msg").first().dispatchEvent("contextmenu");
    await page.waitForSelector(".ck-sheet[open] .ck-attach-extra");
    const theirs = await page.$$eval(".ck-sheet[open] .ck-attach-extra-text", (els) =>
      els.map((e) => e.textContent),
    );
    check(
      theirs.join(",") === "Reply,Copy text",
      "actions: somebody else's message can be answered and copied, not changed",
    );
    await page.locator(".ck-sheet[open] .ck-sheet-close").click();

    // A draft survives a visit to another conversation.
    await page.fill(".ck-input", "half a thought");
    await page.tap(".ck-msgr-back");
    await page.locator(".ck-msgr-row", { hasText: "Weekend hike" }).tap();
    await page.waitForSelector(".ck-msgr-bubble");
    check((await page.inputValue(".ck-input")) === "", "draft: another conversation starts empty");
    await page.tap(".ck-msgr-back");
    await page.locator(".ck-msgr-row", { hasText: "Maya Keller" }).tap();
    await page.waitForSelector(".ck-msgr-bubble");
    check(
      (await page.inputValue(".ck-input")) === "half a thought",
      "draft: and the words are still there on the way back",
    );

    // A new conversation.
    await page.tap(".ck-msgr-back");
    await page.locator(".ck-msgr-btn-primary", { hasText: "New" }).tap();
    await page.waitForSelector(".ck-sheet[open] .ck-msgr-new");
    await page.fill(".ck-sheet[open] .ck-msgr-search input", "ada");
    await page.waitForSelector(".ck-sheet[open] .ck-msgr-row");
    await page.locator(".ck-sheet[open] .ck-msgr-row").tap();
    await page.locator(".ck-sheet[open] .ck-msgr-btn-primary").tap();
    await page.waitForSelector(".ck-msgr-top-name");
    check(
      (await page.locator(".ck-msgr-top-name").textContent()) === "Ada Okafor",
      "new: picking a person opens the conversation with them",
    );
    await page.waitForSelector(".ck-msgr-thread-wrap .ck-msgr-hint");
    check(
      /Type @cat to bring Cat in/.test(
        (await page.locator(".ck-msgr-thread-wrap").textContent()) ?? "",
      ),
      "new: an empty conversation says how to bring the agent in",
    );
    const f = await frame(page);
    check(
      Math.abs(f.dock.bottom - f.height) <= 1,
      "new: the box is at the bottom of an empty conversation too",
    );

    // The list fails once, says so, and Try again loads it.
    await page.goto(`${base}?fail=list`);
    await page.waitForSelector(".ck-msgr-list [role=alert]");
    await page.locator(".ck-msgr-list [role=alert] button").tap();
    await page.waitForSelector(".ck-msgr-row");
    check(true, "list: a failed load says so, and Try again loads it");

    check(errors.length === 0, `phone flows: no page errors (${errors.join("; ")})`);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (failures > 0) {
  console.error(`${failures} Messenger check(s) failed`);
  process.exit(1);
}
console.log("all Messenger checks passed");
