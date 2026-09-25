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
const base = `http://localhost:${server.address().port}/demo/index.html`;

let failures = 0;
const check = (ok, what) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}`);
  if (!ok) failures++;
};

const browser = await chromium.launch({
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
        mics: document.querySelectorAll(".ck-composer .ck-mic").length,
        small: [
          ...document.querySelectorAll(".ck-icon-btn, .ck-send, .ck-starter, .ck-voice-confirm"),
        ]
          .map((e) => e.getBoundingClientRect())
          .filter((r) => r.width > 0 && (r.width < 44 || r.height < 44)).length,
      };
    });
    check(m.overflow <= 0, `${name}: no horizontal scroll (${m.overflow}px over)`);
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
  await context.close();
} finally {
  await browser.close();
  server.close();
}
if (failures) {
  console.log(`\n${failures} browser check(s) failed`);
  process.exit(1);
}
console.log("\nall browser checks passed");
