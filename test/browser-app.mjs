// ChatApp in a real browser, at a phone's width and a desktop's — the part
// of a chat app that each product used to build (and break) on its own.
//
//   pnpm run demo && node test/browser-app.mjs
//
// Drives demo/app.html (a fake transport, the device store) through what a
// person does: send, open the chat list, start a new chat, a temporary chat
// that leaves no row, reload and land back in the chat that was open, stage
// a picture above the text and take it off again, delete a chat, queue a
// message behind a running answer. And at every step: nothing scrolls
// sideways, every control is a 44px target, no word is cut across lines.
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
const url = `http://localhost:${server.address().port}/demo/app.html`;

let failures = 0;
const check = (ok, what) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}`);
  if (!ok) failures++;
};

// A 2×2 PNG: a screenshot, as far as the composer can tell.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEIGBkZGRgYAAA0BgMBCcLDvQAAAABJRU5ErkJggg==",
  "base64",
);

/** Layout facts the eye checks: sideways scroll, small targets, cut words. */
async function layout(page) {
  return page.evaluate(`(() => {
    const small = [...document.querySelectorAll(
      ".ck-app button, .ck-app input:not([type=file]), .ck-app-drawer button, .ck-app-drawer input"
    )]
      .filter((e) => !e.closest(".ck-sheet") && !e.closest("[hidden]"))
      .map((e) => [e, e.getBoundingClientRect()])
      .filter(([, r]) => r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44))
      .filter(([e]) => !e.classList.contains("ck-attach-remove"))
      .map(([e, r]) => (e.getAttribute("aria-label") || e.className || e.tagName) + " " + Math.round(r.width) + "x" + Math.round(r.height));
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      small,
      broken: (${BROKEN_WORDS_SOURCE})(document.body),
    };
  })()`);
}

async function rows(page) {
  return page.$$eval(".ck-history-name", (els) => els.map((e) => e.textContent));
}

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
try {
  for (const [name, width, height] of [
    ["phone", 390, 844],
    ["desktop", 1440, 900],
  ]) {
    const phone = width < 1024;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: phone });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(url);
    await page.waitForSelector(".ck-input");

    let m = await layout(page);
    check(m.overflow <= 0, `${name}: no sideways scroll on a new chat (${m.overflow}px)`);
    check(m.small.length === 0, `${name}: every control is 44px (${m.small.join(", ")})`);
    check(
      (await page.locator(".ck-app-rail").count()) === (phone ? 0 : 1),
      `${name}: the chat list is ${phone ? "a drawer" : "a rail beside the chat"}`,
    );

    // Send, and the answer streams in.
    await page.fill(".ck-input", "How do Lightning invoices expire?");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".ck-turn-answer .ck-md >> text=answer number 1");
    await page.waitForSelector(".ck-reply");
    check(
      (await page.locator(".ck-app-title-text").innerText()).includes("How do Lightning invoices"),
      `${name}: the first message names the chat`,
    );

    // The chat list: a drawer on a phone, with focus kept inside and given back.
    if (phone) {
      await page.click("[aria-label='Open your chats']");
      await page.waitForSelector(".ck-app-drawer[open] .ck-history");
      const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
      check(
        focused === "Close chats",
        `${name}: the drawer opens on its close button, not the keyboard (${focused})`,
      );
      m = await layout(page);
      check(m.small.length === 0, `${name}: drawer controls are 44px (${m.small.join(", ")})`);
      check(m.overflow <= 0, `${name}: the open drawer does not scroll sideways`);
    }
    check(
      (await rows(page)).some((t) => t.includes("How do Lightning invoices")),
      `${name}: the chat is in the list under its title`,
    );
    check(
      (await page.locator(".ck-history-group-title").first().innerText()) === "Today",
      `${name}: grouped under Today`,
    );
    if (phone) {
      await page.keyboard.press("Escape");
      await page.waitForSelector(".ck-app-drawer:not([open])", { state: "attached" });
      const back = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
      check(
        back === "Open your chats",
        `${name}: Escape closes the drawer and focus returns (${back})`,
      );
    }

    // New chat, a second conversation.
    await page.click(".ck-screen-header [aria-label='New chat']");
    await page.waitForSelector(".ck-starter");
    check(
      (await page.locator(".ck-turn").count()) === 0,
      `${name}: New chat opens an empty chat with starters`,
    );
    await page.fill(".ck-input", "Second question about Zürich");
    await page.keyboard.press("Enter");
    // The reply buttons come with the finished answer, not the stream.
    await page.waitForSelector(".ck-reply");

    // Reload: the chat that was open comes back.
    await page.reload();
    await page.waitForSelector(".ck-bubble >> text=Second question about Zürich");
    check(true, `${name}: a reload reopens the chat that was open`);
    const answers = await page.locator(".ck-turn-answer").count();
    check(answers === 1, `${name}: with its answer, from the store (${answers})`);

    // Temporary chat: answered, never listed, gone on reload.
    await page.click("[aria-label='More for this chat']");
    await page.waitForSelector("[role=menu]");
    const menuFocus = await page.evaluate(() => document.activeElement?.getAttribute("role"));
    check(menuFocus === "menuitemcheckbox", `${name}: the menu opens with focus on its first item`);
    await page.click("[role=menuitemcheckbox]");
    await page.waitForSelector(".ck-app-title-note");
    check(
      (await page.locator(".ck-app-title-text").innerText()).includes("Temporary chat"),
      `${name}: the header says the chat is temporary`,
    );
    await page.fill(".ck-input", "secret words nobody keeps");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".ck-turn-answer .ck-md >> text=answer number 1");
    if (phone) await page.click("[aria-label='Open your chats']");
    const listed = await rows(page);
    check(
      listed.length === 2 && !listed.some((t) => t.includes("secret")),
      `${name}: a temporary chat leaves no row (${listed.join(" | ")})`,
    );
    if (phone) await page.keyboard.press("Escape");
    await page.reload();
    await page.waitForSelector(".ck-input");
    await page.waitForTimeout(200);
    check(!(await page.content()).includes("secret words"), `${name}: and is gone after a reload`);

    // A picture is staged ABOVE the text, and comes off again.
    await page.setInputFiles("input[data-ck-source='files']", {
      name: "screenshot.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await page.waitForSelector(".ck-composer .ck-attach-thumb");
    const [thumbY, inputY] = await page.evaluate(() => [
      document.querySelector(".ck-composer .ck-attach-thumb").getBoundingClientRect().top,
      document.querySelector(".ck-input").getBoundingClientRect().top,
    ]);
    check(thumbY < inputY, `${name}: the thumbnail sits above the text`);
    await page.click("[aria-label='Remove screenshot.png']");
    check(
      (await page.locator(".ck-composer .ck-attach-thumb").count()) === 0,
      `${name}: and is removed by its ×`,
    );
    // Sent with words, it shows in the person's own turn.
    await page.setInputFiles("input[data-ck-source='files']", {
      name: "screenshot.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await page.waitForSelector(".ck-composer .ck-attach-thumb");
    await page.fill(".ck-input", "What is in this picture?");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".ck-turn-user .ck-turn-files img");
    await page.waitForSelector(".ck-turn-answer .ck-md >> text=screenshot.png");
    check(true, `${name}: a sent picture shows in the turn and reaches the transport`);

    // Delete, from the list row's "…": two equal cells, then a confirmation.
    if (phone) await page.click("[aria-label='Open your chats']");
    const before = (await rows(page)).length;
    await page.locator(".ck-history-more").first().click();
    const pair = await page.$$eval(".ck-history-pair > button", (bs) =>
      bs.map((b) => Math.round(b.getBoundingClientRect().width)),
    );
    check(
      pair.length === 2 && pair[0] === pair[1],
      `${name}: Rename · Delete are two equal cells (${pair})`,
    );
    await page.click(".ck-history-pair > button:has-text('Delete')");
    await page.click(".ck-history-confirm .ck-history-danger");
    check((await rows(page)).length === before - 1, `${name}: Delete removes the row`);
    if (phone) await page.keyboard.press("Escape");

    m = await layout(page);
    check(m.overflow <= 0, `${name}: no sideways scroll in a full chat (${m.overflow}px)`);
    check(m.broken.length === 0, `${name}: no word cut across lines (${m.broken.join(", ")})`);
    check(
      m.small.length === 0,
      `${name}: every control is 44px in a full chat (${m.small.join(", ")})`,
    );
    check(errors.length === 0, `${name}: no page errors ${errors.join(" | ")}`);
    await context.close();
  }

  // The queue: the next message typed while an answer runs goes after it.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${url}?delay=60`);
    await page.waitForSelector(".ck-input");
    await page.fill(".ck-input", "first");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".ck-send-stop");
    await page.fill(".ck-input", "second, queued");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".ck-app-queue li");
    check(true, "queue: a message sent during an answer is shown as queued");
    await page.waitForSelector(".ck-turn-answer .ck-md >> text=answer number 2", {
      timeout: 20000,
    });
    check(
      (await page.locator(".ck-app-queue li").count()) === 0,
      "queue: and is sent when the answer lands",
    );
    // Stop keeps what had arrived.
    await page.fill(".ck-input", "third");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".ck-turn-answer .ck-md >> text=“third”");
    await page.click(".ck-send-stop");
    await page.waitForSelector(".ck-send:not(.ck-send-stop)");
    check(
      (await page.locator(".ck-turn-answer").count()) === 3,
      "stop: the half-written answer is kept",
    );
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (failures) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
