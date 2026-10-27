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

  // 0.19 — what the first products to adopt ChatApp had to work around. The
  // lab page wraps ChatApp in StrictMode and puts its handle on window.ckChat.
  for (const [name, width, height] of [
    ["phone", 390, 844],
    ["desktop", 1440, 900],
  ]) {
    const phone = width < 1024;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: phone });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const lab = `${url}?lab=1&delay=5`;
    const calls = () => page.evaluate(() => window.ckCalls);

    // A message handed over by another page is sent once, StrictMode or not.
    await page.goto(`${lab}&initial=${encodeURIComponent("Hello from the home box")}`);
    await page.waitForSelector(".ck-turn-answer .ck-md >> text=answer number 1");
    await page.waitForTimeout(150);
    check(
      (await page.locator(".ck-bubble", { hasText: "Hello from the home box" }).count()) === 1 &&
        (await calls()).length === 1,
      `${name}: initialMessage is sent exactly once under StrictMode (${(await calls()).length})`,
    );

    // A ?q= link only fills the box, and leaves the address.
    await page.goto(`${lab}&q=${encodeURIComponent("Words from a link")}`);
    await page.waitForFunction(
      () => document.querySelector(".ck-input")?.value === "Words from a link",
    );
    await page.waitForTimeout(150);
    check((await calls()).length === 0, `${name}: a deep link is never sent by itself`);
    check(!page.url().includes("q="), `${name}: and is taken off the address (${page.url()})`);
    check(
      (await page.locator(".ck-turn").count()) === 0,
      `${name}: it lands in a new chat, not the one from before`,
    );
    await page.fill(".ck-input", "");

    // Starters keep their language.
    check(
      (await page.locator(".ck-starter[lang='gsw']").count()) === 1,
      `${name}: a starter keeps its lang attribute`,
    );

    // The handle sends; two failures keep their own words.
    await page.evaluate(() => window.ckChat.send("fail: The first reason."));
    await page.waitForSelector(".ck-failed >> text=The first reason.");
    await page.evaluate(() => window.ckChat.send("fail: The second reason."));
    await page.waitForSelector(".ck-failed >> text=The second reason.");
    check(
      (await page.locator(".ck-failed", { hasText: "The first reason." }).count()) === 1,
      `${name}: each failed bubble keeps its own reason`,
    );
    await page.evaluate(() => window.ckChat.send("fail-raw"));
    await page.waitForSelector(".ck-failed >> text=That did not go through.");
    check(true, `${name}: a raw error shows the thread's own words, never its message`);

    // Retry sends the pictures again.
    await page.evaluate(async () => {
      const bytes = Uint8Array.from(
        atob(
          "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEIGBkZGRgYAAA0BgMBCcLDvQAAAABJRU5ErkJggg==",
        ),
        (c) => c.charCodeAt(0),
      );
      await window.ckChat.send("fail: With a picture.", [
        new File([bytes], "shot.png", { type: "image/png" }),
      ]);
    });
    await page.waitForSelector(".ck-failed >> text=With a picture.");
    check(
      (await page.locator(".ck-turn-user .ck-turn-files img").count()) === 1,
      `${name}: a File handed to send() shows in the person's turn`,
    );
    const before = (await calls()).length;
    await page.click(".ck-turn-answer .ck-action:has-text('Try again')");
    await page.waitForFunction((n) => window.ckCalls.length > n, before);
    const retried = (await calls()).at(-1);
    check(
      retried.text === "fail: With a picture." && retried.files === 1,
      `${name}: Retry sends the picture again (${retried.files})`,
    );

    // Stop drops a half answer the transport marked as unchecked.
    await page.fill(".ck-input", "unchecked please");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".ck-turn-answer .ck-md >> text=Half an answer");
    await page.click(".ck-send-stop");
    await page.waitForSelector(".ck-stopped");
    check(
      (await page
        .locator(".ck-turn-answer:not(.ck-turn-pinned) .ck-md", { hasText: "Half an answer" })
        .count()) === 0 &&
        !(await page.locator(".ck-thread").innerText()).includes("Half an answer"),
      `${name}: Stop drops a half answer marked unchecked`,
    );

    // Footers know the latest answer, and can send for the person.
    await page.evaluate(() => window.ckChat.send("first real question", [], { newChat: true }));
    await page.waitForSelector(".ck-turn-answer .ck-md >> text=answer number 1");
    await page.evaluate(() => window.ckChat.send("second real question"));
    await page.waitForSelector(".ck-turn-answer .ck-md >> text=answer number 2");
    await page.waitForSelector(".ck-send:not(.ck-send-stop)");
    check(
      (await page.locator("[data-latest='yes']").count()) === 1 &&
        (await page.locator("[data-latest='no']").count()) === 1,
      `${name}: renderFooter is told which answer is the latest`,
    );
    await page.click("[data-latest='yes'] .ck-reply:has-text('Shorter')");
    await page.waitForSelector(".ck-bubble >> text=Make that shorter, please.");
    check(true, `${name}: a footer chip sends its sentence in one tap`);
    await page.waitForSelector(".ck-turn-answer .ck-md >> text=answer number 3");

    // The product's row in the attach sheet, and its chip on the sent message.
    await page.click(".ck-composer [aria-label='Attach a screenshot or file']");
    await page.waitForSelector(".ck-sheet .ck-attach-extra >> text=Your things");
    const sheet = await page.evaluate(() => {
      const row = document.querySelector(".ck-attach-extra").getBoundingClientRect();
      const source = document.querySelector(".ck-sheet .ck-attach-source").getBoundingClientRect();
      return {
        h: row.height,
        below: row.top >= source.bottom,
        w: document.documentElement.scrollWidth - innerWidth,
      };
    });
    check(
      sheet.h >= 44 && sheet.below && sheet.w <= 0,
      `${name}: "Your things" is a 44px row under Camera · Photos · Files (${JSON.stringify(sheet)})`,
    );
    await page.click(".ck-attach-extra");
    await page.waitForSelector(".ck-sheet", { state: "hidden" });
    await page.fill(".ck-input", "What is it worth?");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".ck-turn-user .ck-turn-chip >> text=My bike listing");
    check(true, `${name}: the product's chip shows on the sent message at once`);
    await page.waitForSelector(".ck-turn-answer .ck-md >> text=answer number 4");
    await page.waitForSelector(".ck-send:not(.ck-send-stop)");

    // The product's line in the chat list.
    if (phone) await page.click("[aria-label='Open your chats']");
    check(
      (await page.locator(".ck-history-slot").innerText()).includes("Only on this device."),
      `${name}: the chat list carries the product's line`,
    );
    {
      const m = await layout(page);
      check(
        m.small.length === 0,
        `${name}: list controls are 44px with the slot (${m.small.join(", ")})`,
      );
      check(m.overflow <= 0, `${name}: no sideways scroll with the slot`);
    }
    if (phone) await page.keyboard.press("Escape");

    // A temporary chat says when it ends.
    await page.click("[aria-label='More for this chat']");
    await page.click("[role=menuitemcheckbox]");
    await page.fill(".ck-input", "a temporary question");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".ck-turn-answer .ck-md >> text=answer number 1");
    const tempId = (await calls()).at(-1).chatId;
    await page.click(".ck-screen-header [aria-label='New chat']");
    const ended = await page.evaluate(() => window.ckEnded);
    check(
      ended.length === 1 && ended[0] === tempId,
      `${name}: onTemporaryEnd names the chat when it is left (${ended.join(",")})`,
    );

    const m = await layout(page);
    check(m.overflow <= 0, `${name}: lab: no sideways scroll (${m.overflow}px)`);
    check(m.broken.length === 0, `${name}: lab: no word cut (${m.broken.join(", ")})`);
    check(m.small.length === 0, `${name}: lab: every control is 44px (${m.small.join(", ")})`);
    check(errors.length === 0, `${name}: lab: no page errors ${errors.join(" | ")}`);
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
