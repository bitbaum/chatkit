// The standard, checked in a real browser — the part no unit test can see.
//
//   pnpm run demo && node test/browser.mjs
//
// Each check is something that shipped broken in at least one fleet chat:
//  - text and input at 16px (below it iOS zooms the page on focus)
//  - a microphone in every composer
//  - every control at least 44px (a thumb has to land on it)
//  - no horizontal scroll at 390px, light and dark
//  - the mic still works where the browser's recogniser is silent: headless
//    Chromium exposes webkitSpeechRecognition with no speech service behind it
//    — exactly heidi's measured failure — so the press must fall back to
//    recording, post the audio, and put the words in the box.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { BROKEN_WORDS_SOURCE } from "../dist/audit.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const types = {
  ".html": "text/html",
  ".wav": "audio/wav",
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
const base = `http://localhost:${server.address().port}/demo/index.html`;

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
  for (const [name, width, height, dark] of [
    ["desktop light", 1280, 800, false],
    ["desktop dark", 1280, 800, true],
    ["phone dark", 390, 844, true],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    if (dark) await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.waitForSelector(".ck-input");
    const m = await page.evaluate(() => {
      const px = (sel) =>
        [...document.querySelectorAll(sel)].map((e) => parseFloat(getComputedStyle(e).fontSize));
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        input: Math.min(...px(".ck-input")),
        text: Math.min(...px(".ck-md, .ck-bubble")),
        composers: document.querySelectorAll(".ck-composer").length,
        replies: document.querySelectorAll(".ck-reply").length,
        rawReplies: document.body.innerText.includes("quick_replies"),
        replyHeading: document.body.innerText.includes("Quick follow-up options"),
        mics: document.querySelectorAll(".ck-composer .ck-mic").length,
        small: [
          ...document.querySelectorAll(
            ".ck-icon-btn, .ck-send, .ck-starter, .ck-reply, .ck-voice-confirm, .ck-action",
          ),
        ]
          .map((e) => e.getBoundingClientRect())
          .filter((r) => r.width > 0 && (r.width < 44 || r.height < 44)).length,
      };
    });
    check(m.overflow <= 0, `${name}: no horizontal scroll (${m.overflow}px over)`);
    check(m.replies === 3 && !m.rawReplies, `${name}: suggested replies as buttons (${m.replies})`);
    check(!m.replyHeading, `${name}: no heading the model wrote over the reply buttons`);
    check(m.input >= 16, `${name}: input text >= 16px (${m.input}px)`);
    check(m.text >= 16, `${name}: message text >= 16px (${m.text}px)`);
    check(
      m.composers > 0 && m.mics === m.composers,
      `${name}: a mic in every composer (${m.mics}/${m.composers})`,
    );
    check(m.small === 0, `${name}: every control >= 44px (${m.small} smaller)`);
    check(errors.length === 0, `${name}: no page errors ${errors.join(" | ")}`);
    await page.close();
  }

  // Words are never broken mid-letter. Substrata's answer table at 390px read
  // "Te / rm" and "Di / re / ct / or / y" (2026-10-22): `overflow-wrap:
  // anywhere` on the markdown lowers every table cell's minimum width to one
  // letter, so a three-column table squeezed its first column to nothing. A
  // word may wrap onto the next line; it may never be cut. Measured, not read
  // from the CSS: every word of every answer is laid out in a Range and must
  // sit on one line (src/audit.ts, exported as @bitbaum/chatkit/audit so every
  // product can run the same check against its own pages).
  // The audit can fail: a word forced onto two lines is reported, a word that
  // simply wraps to the next line is not. A gate that cannot fail is no gate.
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
    await page.setContent(
      `<div style="width:30px;overflow-wrap:anywhere;font:16px sans-serif">Directory</div>
       <div style="width:120px;font:16px sans-serif">A directory that wraps between words</div>`,
    );
    const found = await page.evaluate(`(${BROKEN_WORDS_SOURCE})(document.body)`);
    check(
      found.length === 1 && found[0] === "Directory",
      `the audit reports a squeezed word and not a wrapped sentence (${found.join(",")})`,
    );
    await page.close();
  }
  for (const width of [320, 390, 1280]) {
    for (const file of ["index.html", "screen.html"]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(base.replace("index.html", file));
      await page.waitForSelector(".ck-md");
      await page.waitForTimeout(200);
      const broken = await page.evaluate(`(${BROKEN_WORDS_SOURCE})(document.body)`);
      check(
        broken.length === 0,
        `${file} at ${width}px: no word is cut across lines (${broken.slice(0, 8).join(", ")})`,
      );
      // Charts in answers (0.15): the screen demo carries a bars block drawn
      // by an injected renderer (the demo's stub; chartkit in Substrata) and
      // a line block the stub declines, so chatkit's own fallback draws it —
      // the caption and a table. Both must fit the column at every width.
      if (file === "screen.html") {
        const c = await page.evaluate(() => {
          const charts = [...document.querySelectorAll(".ck-chart")];
          const drawn = document.querySelector(".ck-chart[data-chart='bars'] .demo-bars");
          const fallback = document.querySelector(".ck-chart-table");
          return {
            charts: charts.length,
            drawnBars: drawn ? drawn.querySelectorAll(".demo-bar").length : 0,
            fallbackCaption: fallback?.querySelector(".ck-chart-caption")?.textContent ?? "",
            fallbackRows: fallback?.querySelectorAll("tbody tr").length ?? 0,
            fit: charts.every((e) => e.scrollWidth <= e.clientWidth + 1),
            overflow: document.documentElement.scrollWidth - window.innerWidth,
          };
        });
        check(
          c.charts === 2 && c.drawnBars === 4,
          `${file} at ${width}px: the bars chart is drawn by the injected renderer (${c.drawnBars} bars)`,
        );
        check(
          c.fallbackRows === 10 && /by year/.test(c.fallbackCaption),
          `${file} at ${width}px: the line chart falls back to its caption and a table (${c.fallbackRows} rows, "${c.fallbackCaption}")`,
        );
        check(
          c.fit && c.overflow <= 0,
          `${file} at ${width}px: charts fit, no horizontal overflow`,
        );
      }
      await page.close();
    }
  }

  // ChatScreen: the conversation is the whole display. Its scroller runs from
  // the top edge to the bottom edge (header and composer float over it), yet
  // the end of the last answer rests ABOVE the composer, never behind it —
  // on first load, before anyone scrolls.
  for (const [name, width, height] of [
    ["screen phone", 390, 844],
    ["screen desktop", 1280, 800],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(base.replace("index.html", "screen.html"));
    await page.waitForSelector(".ck-screen .ck-input");
    await page.waitForTimeout(200);
    const s = await page.evaluate(() => {
      const r = (sel) => document.querySelector(sel)?.getBoundingClientRect();
      const thread = r(".ck-screen .ck-thread");
      const composer = r(".ck-screen-dock .ck-composer");
      const replies = [...document.querySelectorAll(".ck-screen .ck-reply")].map((e) =>
        e.getBoundingClientRect(),
      );
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        top: thread.top,
        bottom: Math.round(thread.bottom),
        height: window.innerHeight,
        lastEnd: Math.max(...replies.map((x) => x.bottom)),
        composerTop: composer.top,
        glassSmall: [...document.querySelectorAll(".ck-screen .ck-glass")]
          .map((e) => e.getBoundingClientRect())
          .filter((x) => x.width < 44 || x.height < 44).length,
        jump: !!document.querySelector(".ck-screen .ck-jump"),
        stack: (() => {
          const el = document.querySelector(".ck-screen .ck-stack");
          if (!el) return null;
          const tiles = [...el.querySelectorAll(".ck-stack-node")].map((n) =>
            n.getBoundingClientRect(),
          );
          return {
            fits: el.scrollWidth <= el.clientWidth + 1,
            tiles: tiles.length,
            narrowest: Math.round(Math.min(...tiles.map((t) => t.width))),
          };
        })(),
        thought:
          document.querySelector(".ck-screen details.ck-thinking > summary")?.textContent ?? "",
      };
    });
    check(s.overflow <= 0, `${name}: no horizontal scroll (${s.overflow}px over)`);
    check(
      !!s.stack && s.stack.fits && s.stack.tiles === 6 && s.stack.narrowest >= 90,
      `${name}: the stack figure fits, six tiles, narrowest ${s.stack?.narrowest}px`,
    );
    check(
      /^Thought for 3m 38s/.test(s.thought),
      `${name}: "Thought for 3m 38s" above the answer (${s.thought})`,
    );
    check(
      s.top === 0 && s.bottom === s.height,
      `${name}: the conversation fills the display (${s.top}–${s.bottom} of ${s.height}px)`,
    );
    check(
      s.lastEnd <= s.composerTop,
      `${name}: the last answer ends above the composer (${s.lastEnd} <= ${s.composerTop})`,
    );
    check(!s.jump, `${name}: opens at the latest message (no jump button)`);
    check(s.glassSmall === 0, `${name}: floating header buttons >= 44px`);
    await page.close();
  }

  // An empty box is one line, whatever width it was measured at. Chromium
  // counts the placeholder in scrollHeight, so a composer cleared while it was
  // narrow (a sheet still opening) used to lock at its maximum height with
  // nothing typed — and stayed there once the layout settled.
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(base);
    const box = page.locator(".ck-composer").first();
    const input = box.locator(".ck-input");
    await input.waitFor();
    const one = await input.evaluate((e) => e.getBoundingClientRect().height);
    await box.evaluate((e) => (e.style.width = "60px"));
    await input.fill("x");
    await input.fill("");
    await box.evaluate((e) => (e.style.width = ""));
    await page.waitForTimeout(100);
    const after = await input.evaluate((e) => e.getBoundingClientRect().height);
    check(after <= one + 1, `an emptied composer is one line again (${after}px, was ${one}px)`);
    await page.close();
  }

  // A thumb down asks why: a sheet with one tap per reason, each a 44px
  // target, and the verdict reaches the app only when it is sent.
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const got = [];
    page.on("console", (m) => m.text().startsWith("feedback") && got.push(m.text()));
    await page.goto(base);
    await page.waitForSelector("#conversation .ck-turn-answer");
    const bad = page
      .locator("#conversation .ck-turn-answer")
      .last()
      .locator('button[aria-label="Bad answer"]');
    await bad.click();
    await page.waitForSelector(".ck-sheet[open] .ck-feedback-reason");
    // Measured at rest: mid-way through the sheet's opening animation a button
    // is 43.9px, which is not what a thumb meets.
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
    const reasons = await page.evaluate(() =>
      [...document.querySelectorAll(".ck-sheet[open] .ck-feedback-reason")].map(
        (b) => b.getBoundingClientRect().height,
      ),
    );
    check(
      reasons.length === 7 && reasons.every((h) => h >= 44),
      `thumb down asks why: ${reasons.length} reasons, each >= 44px`,
    );
    check(got.length === 0, "nothing is sent before the person sends it");
    await page.locator(".ck-sheet[open] .ck-feedback-reason").nth(1).click();
    await page.locator(".ck-sheet[open] .ck-feedback-send").click();
    await page.waitForTimeout(100);
    check(got.length === 1 && /dead_end/.test(got[0]), `the reason reaches the app (${got[0]})`);
    await page.close();
  }

  // An app's own variables win: a --ck-* set on :root must reach the chat
  // (the defaults are declared at zero specificity for exactly this).
  {
    const page = await browser.newPage();
    await page.goto(base);
    await page.waitForSelector("#conversation .ck-link");
    const bg = await page.evaluate(() => {
      document.documentElement.style.setProperty("--ck-accent", "rgb(0, 128, 0)");
      return getComputedStyle(document.querySelector("#conversation .ck-link")).textDecorationColor;
    });
    check(bg === "rgb(0, 128, 0)", `an app's :root --ck-accent reaches the chat (${bg})`);
    await page.close();
  }

  // A phone screenshot is shrunk in the browser before it is sent: the full
  // 1290×2796 original never leaves the device, and what goes out fits the
  // limit, whatever format it arrived in.
  {
    const page = await browser.newPage();
    await page.goto(base);
    const box = page.locator("#empty");
    await box.locator(".ck-input").waitFor();
    const png = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 1290;
      c.height = 2796;
      const ctx = c.getContext("2d");
      const img = ctx.createImageData(c.width, c.height);
      for (let i = 0; i < img.data.length; i++) img.data[i] = (i * 2654435761) % 251;
      ctx.putImageData(img, 0, 0);
      return c.toDataURL("image/png").split(",")[1];
    });
    const original = Buffer.from(png, "base64");
    await box.locator('input[data-ck-source="photos"]').setInputFiles({
      name: "IMG_0001.PNG",
      mimeType: "image/png",
      buffer: original,
    });
    await box
      .locator(".ck-attach-thumb")
      .waitFor({ timeout: 10000 })
      .catch(() => {});
    check(
      (await box.locator(".ck-attach-thumb").count()) === 1,
      `attach: a ${(original.length / 1e6).toFixed(1)} MB screenshot attaches`,
    );
    await box.locator(".ck-input").fill("what does this say?");
    await box.locator(".ck-send").click();
    const sent = await page.evaluate(async () => {
      const a = window.__sent?.[0];
      if (!a) return null;
      const img = new Image();
      img.src = `data:${a.mimeType};base64,${a.dataBase64}`;
      await img.decode();
      return {
        mime: a.mimeType,
        name: a.name,
        bytes: Math.floor(a.dataBase64.length * 0.75),
        w: img.width,
        h: img.height,
      };
    });
    check(
      sent !== null && sent.mime === "image/jpeg" && Math.max(sent.w, sent.h) === 1024,
      `attach: sent as JPEG at 1024px on the long edge (${JSON.stringify(sent)})`,
    );
    check(
      sent !== null && sent.bytes <= 2_800_000,
      `attach: what is sent fits the limit (${sent?.bytes} bytes)`,
    );
    await page.close();
  }

  // A recording that already exists goes through the paperclip to the same
  // server leg as the mic, under its own name, and its words land in the box.
  // Nothing is staged as an attachment: a memo is words, not a file the model
  // reads. The file arrives typeless, as Android's picker hands over .m4a.
  {
    const page = await browser.newPage();
    let filename = "";
    await page.route("**/api/transcribe", async (route) => {
      filename = /filename="([^"]+)"/.exec(route.request().postData() ?? "")?.[1] ?? "";
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ text: "use it to improve it" }),
      });
    });
    await page.goto(base);
    const box = page.locator("#empty");
    await box.locator(".ck-input").waitFor();
    await box.locator('input[data-ck-source="files"]').setInputFiles({
      name: "Meine Aufnahme 12.m4a",
      mimeType: "application/octet-stream",
      buffer: Buffer.alloc(4096, 1),
    });
    await page
      .waitForFunction(() => document.querySelector("#empty .ck-input")?.value !== "", null, {
        timeout: 5000,
      })
      .catch(() => {});
    check(
      (await box.locator(".ck-input").inputValue()) === "use it to improve it",
      "memo: a recording picked through the paperclip is transcribed into the input",
    );
    check(filename === "Meine Aufnahme 12.m4a", `memo: posted under its own name (${filename})`);
    check(
      (await box.locator(".ck-attach-item").count()) === 0,
      "memo: nothing is staged as an attachment",
    );
    await page.close();
  }

  // On a phone the paperclip opens Camera / Photos / Files — each a real
  // input, each 44px+, and the sheet goes away with Escape or the scrim.
  // A mouse skips the sheet: on a desktop all three are the same dialog.
  {
    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await phone.newPage();
    await page.goto(base);
    const box = page.locator("#empty");
    await box.locator(".ck-input").waitFor();
    await box.locator('button[aria-haspopup="dialog"]').click();
    const sheet = box.locator(".ck-sheet");
    check(await sheet.isVisible(), "attach sheet: the paperclip opens it on a phone");
    const sources = await page.$$eval(".ck-sheet[open] .ck-attach-source", (els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { src: e.dataset.ckSource, ok: r.width >= 44 && r.height >= 44 };
      }),
    );
    check(
      sources.map((s) => s.src).join(",") === "camera,photos,files" && sources.every((s) => s.ok),
      `attach sheet: Camera, Photos, Files, each >= 44px (${JSON.stringify(sources)})`,
    );
    const chooser = page.waitForEvent("filechooser", { timeout: 3000 }).catch(() => null);
    await sheet.locator('.ck-attach-source[data-ck-source="photos"]').click();
    const fc = await chooser;
    check(
      fc !== null && (await fc.element().getAttribute("accept")) === "image/*",
      "attach sheet: Photos opens an images-only picker",
    );
    check(!(await sheet.isVisible()), "attach sheet: closes once a source is chosen");
    await box.locator('button[aria-haspopup="dialog"]').click();
    await page.keyboard.press("Escape");
    check(!(await sheet.isVisible()), "attach sheet: Escape closes it");
    await box.locator('button[aria-haspopup="dialog"]').click();
    await page.mouse.click(195, 100);
    check(!(await sheet.isVisible()), "attach sheet: a tap on the scrim closes it");
    // A file nobody can read inline gets a sentence, not a prompt full of bytes.
    await box.locator('input[data-ck-source="files"]').setInputFiles({
      name: "invoice.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7 binary"),
    });
    check(
      (await box.locator(".ck-attach-item").count()) === 0 &&
        /invoice\.pdf/.test((await box.locator(".ck-note").textContent()) ?? ""),
      "attach: a PDF is explained, not staged as text",
    );
    await phone.close();
  }
  {
    const page = await browser.newPage();
    await page.goto(base);
    const box = page.locator("#empty");
    await box.locator(".ck-input").waitFor();
    const chooser = page.waitForEvent("filechooser", { timeout: 3000 }).catch(() => null);
    await box.locator('button[aria-haspopup="dialog"]').click();
    const fc = await chooser;
    check(
      fc !== null && (await page.locator(".ck-sheet[open]").count()) === 0,
      "attach: with a mouse the paperclip opens the file dialog directly",
    );
    await page.close();
  }

  const context = await browser.newContext({ permissions: ["microphone"] });
  const page = await context.newPage();
  let posted = 0;
  await page.route("**/api/transcribe", async (route) => {
    posted = route.request().postDataBuffer()?.length ?? 0;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ text: "hello from the mic" }),
    });
  });
  await page.goto(base);
  const box = page.locator("#empty");
  await box.locator(".ck-mic").click();
  check(await box.locator(".ck-voice-bar").isVisible(), "mic: pressing it shows the recording bar");
  // Past the silent-recogniser watchdog (4 s): it must now be recording.
  await page.waitForTimeout(5500);
  await box.locator(".ck-voice-confirm").click();
  await page
    .waitForFunction(() => document.querySelector("#empty .ck-input")?.value !== "", null, {
      timeout: 5000,
    })
    .catch(() => {});
  check(
    posted > 0,
    `mic: a silent recogniser falls back to recording and posts the audio (${posted} bytes)`,
  );
  check(
    (await box.locator(".ck-input").inputValue()) === "hello from the mic",
    "mic: the spoken sentence lands in the input",
  );

  // A failed transcription keeps the take: the server's reason is shown and
  // "Try again" sends the same audio (OrangeCat, 2026-10-07: "check your
  // connection" while the server had said it was busy, and the words gone).
  const sizes = [];
  await page.unroute("**/api/transcribe");
  await page.route("**/api/transcribe", async (route) => {
    sizes.push(route.request().postDataBuffer()?.length ?? 0);
    if (sizes.length === 1) {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: "Dictation is busy right now." }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ text: "second time lucky" }),
    });
  });
  await box.locator(".ck-input").fill("");
  await box.locator(".ck-mic").click();
  await page.waitForTimeout(800);
  await box.locator(".ck-voice-confirm").click();
  const retry = box.locator(".ck-problem-retry");
  await retry.waitFor({ timeout: 5000 }).catch(() => {});
  check(
    (await box.locator(".ck-problem-detail").textContent())?.includes("busy") === true,
    "mic: a failed transcription shows the server's reason",
  );
  check(await retry.isVisible(), "mic: a failed take offers Try again");
  await retry.click();
  await page
    .waitForFunction(() => document.querySelector("#empty .ck-input")?.value !== "", null, {
      timeout: 5000,
    })
    .catch(() => {});
  check(
    (await box.locator(".ck-input").inputValue()) === "second time lucky" &&
      sizes.length === 2 &&
      sizes[0] === sizes[1],
    `mic: Try again resends the same recording (${sizes.join(" / ")} bytes)`,
  );
  check((await box.locator(".ck-problem").count()) === 0, "mic: the problem clears once it lands");
  await context.close();

  // Under every answer: Copy, and Listen where the browser can speak. While it
  // reads, the row is a player with Stop. Headless Chromium has no voices and
  // ends an utterance at once, so the voice is a stand-in that reads until
  // cancelled — the contract under test is the row, not the synthesiser.
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(() => {
      let current = null;
      Object.defineProperty(window, "speechSynthesis", {
        value: {
          speak(u) {
            current = u;
          },
          cancel() {
            const u = current;
            current = null;
            u?.onend?.();
          },
        },
      });
    });
    await page.goto(base);
    await page.waitForSelector("#conversation .ck-turn-answer");
    const listen = page.locator("#conversation .ck-action[aria-label='Listen']").first();
    check(
      (await listen.count()) > 0,
      "answer actions: Listen under an answer where a voice exists",
    );
    check(
      (await page.locator("#conversation .ck-action[aria-label='Copy']").count()) > 0,
      "answer actions: Copy under every answer",
    );
    await listen.click();
    await page.waitForTimeout(150);
    check(
      (await page.locator("#conversation .ck-player .ck-action-stop").count()) === 1,
      "answer actions: a player with Stop while an answer is read",
    );
    await page.locator("#conversation .ck-player .ck-action-stop").click();
    await page.waitForTimeout(100);
    check(
      (await page.locator("#conversation .ck-player").count()) === 0,
      "answer actions: Stop ends the reading and the row returns",
    );
    await page.close();
  }

  // On a touch screen the sources of an answer are ONE button that opens a
  // sheet with every record; on a mouse, chips.
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto(base.replace("index.html", "screen.html"));
    await page.waitForSelector(".ck-screen .ck-sources");
    const open = page.locator(".ck-sources-open").first();
    check((await open.count()) === 1, "sources: one button on a touch screen, not a row of chips");
    await open.click();
    await page.waitForSelector(".ck-sheet[open] .ck-source-row");
    const rows = await page.locator(".ck-sheet[open] .ck-source-row").count();
    check(rows >= 2, `sources: the sheet lists every record (${rows})`);
    const small = await page
      .locator(".ck-sheet[open] .ck-source-row")
      .evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).length);
    check(small === 0, "sources: every row is a finger-sized target");
    await context.close();
    const desk = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await desk.goto(base.replace("index.html", "screen.html"));
    await desk.waitForSelector(".ck-screen .ck-sources");
    check(
      (await desk.locator(".ck-sources-open").count()) === 0 &&
        (await desk.locator(".ck-sources .ck-source").count()) >= 2,
      "sources: chips on a mouse",
    );
    await desk.close();
  }

  // An empty box is ONE row on the narrowest phone, however long the
  // placeholder: it is cut at the edge, never wrapped into a clipped second
  // line (320px, 2026-10-21).
  {
    const page = await browser.newPage({ viewport: { width: 320, height: 640 } });
    await page.goto(base);
    const input = page.locator("#empty .ck-input");
    await input.waitFor();
    const m = await input.evaluate((e) => {
      e.placeholder = "Name a new project, or ask anything at all about it…";
      const r = e.getBoundingClientRect();
      return { height: r.height, line: parseFloat(getComputedStyle(e).lineHeight) };
    });
    check(
      m.height < m.line * 2,
      `an empty box with a long placeholder is one row at 320px (${m.height}px, line ${m.line}px)`,
    );
    await page.close();
  }
  // The visual-answer contract: genuine selection/submission, image dialog,
  // and element bounds at the narrowest supported phone width.
  for (const width of [320, 390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(base);
    const form = page.locator("#conversation .ck-choice");
    await form.waitFor();
    check(
      await form.locator('button[type="submit"]').isDisabled(),
      `choices require selection at ${width}px`,
    );
    const overflow = await page
      .locator("#conversation .ck-rich")
      .evaluateAll((es) => es.some((e) => e.scrollWidth > e.clientWidth + 1));
    check(!overflow, `visual blocks fit their containers at ${width}px`);
    const audio = page.locator("#conversation .ck-audio audio");
    check(
      await audio.evaluate((a) => a.paused && !a.autoplay && a.preload === "none"),
      `audio waits for explicit playback at ${width}px`,
    );
    await audio.evaluate((a) => a.play());
    check(
      await audio.evaluate((a) => !a.paused && a.duration > 10),
      `the provided WAV plays at ${width}px`,
    );
    await audio.evaluate((a) => a.pause());
    const photo = page.locator("#conversation .ck-photo").first();
    await photo.click();
    check(
      (await page.locator("#conversation dialog[open]").count()) === 1,
      `image opens in a dialog at ${width}px`,
    );
    await page.keyboard.press("Escape");
    await form.getByText("Build the first version", { exact: true }).click();
    check(
      await form.locator('button[type="submit"]').isEnabled(),
      `selecting enables continue at ${width}px`,
    );
    await form.locator('button[type="submit"]').click();
    check(
      (await page.locator("#conversation .ck-bubble").last().textContent()) ===
        "Build the first version",
      `continue sends the selected reply once at ${width}px`,
    );
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (failures) {
  console.log(`\n${failures} browser check(s) failed`);
  process.exit(1);
}
console.log("\nall browser checks passed");
