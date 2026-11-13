// Voice mode, driven in a real browser with a real (fake-device) microphone.
//
//   pnpm run demo && node test/browser-voice.mjs
//
// What each check is for: the call must open listening from a tap, a press
// must end the person's turn and send what was heard, the answer must be read
// (as prose, not markdown) and the floor handed back, a press while it reads
// must cut in, End must close the microphone and the voice, and every way a
// call can fail (nothing heard, no answer, a dead transcription) must end it
// with words on screen, never a silent open microphone.
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
const base = `http://localhost:${server.address().port}/demo/voice.html`;

let failures = 0;
const check = (ok, what) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}`);
  if (!ok) failures++;
};

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});

/** A page with every microphone track it ever opened counted, so "closed" is a fact. */
async function open(query, width = 390) {
  const context = await browser.newContext({
    viewport: { width, height: 800 },
    permissions: ["microphone"],
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__tracks = [];
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
      const s = await real(c);
      window.__tracks.push(...s.getTracks());
      return s;
    };
  });
  await page.goto(`${base}?${query}`);
  await page.click("#open-voice");
  return { context, page };
}
const phase = (page) =>
  page.locator(".ck-voicemode-body").getAttribute("data-phase", { timeout: 5000 });
const until = (page, want, ms = 8000) =>
  page.waitForSelector(`.ck-voicemode-body[data-phase="${want}"]`, { timeout: ms });
const liveTracks = (page) =>
  page.evaluate(() => window.__tracks.filter((t) => t.readyState === "live").length);

try {
  // ── the loop ────────────────────────────────────────────────────────────
  {
    const { context, page } = await open("voiceMs=1200");
    await until(page, "listening");
    check((await phase(page)) === "listening", "the call opens listening, from a tap");
    await page.waitForFunction(() => window.__tracks.length > 0);
    check((await liveTracks(page)) > 0, "the microphone is open while listening");
    const orb = page.locator(".ck-voicemode-orb");
    const box = await orb.boundingBox();
    check(box && box.width >= 88 && box.height >= 88, "the button is a thumb's size and more");
    await page.waitForTimeout(700);
    await orb.click();
    await until(page, "thinking");
    check(
      (await page.locator(".ck-voicemode-line").innerText()).includes("what is next today"),
      "what was heard is shown while the answer is on its way",
    );
    check((await liveTracks(page)) === 0, "the microphone is closed while thinking");
    await until(page, "speaking");
    const line = await page.locator(".ck-voicemode-line").innerText();
    check(
      line.includes("The report, at five.") && !line.includes("**"),
      "the answer is shown as prose, not markdown",
    );
    const spoken = await page.evaluate(() => window.__voice.spoken.at(-1));
    check(spoken === "The report, at five.", "and read aloud as prose");
    check((await liveTracks(page)) === 0, "the microphone is closed while the answer is read");
    await until(page, "listening");
    check(
      (await page.evaluate(() => window.__voice.turns.length)) === 1,
      "one turn was sent, once",
    );
    check(true, "the floor goes back to the person when the reading ends");

    // cut in
    await page.waitForTimeout(700);
    await orb.click();
    await until(page, "speaking");
    await orb.click();
    await until(page, "listening", 2000);
    check(
      (await page.evaluate(() => window.__voice.speaking)) === false,
      "a press while it reads cuts in: the voice stops and it listens",
    );

    // end
    await page.waitForFunction(() => window.__tracks.some((t) => t.readyState === "live"));
    await page.locator(".ck-voicemode-end").click();
    await page.waitForFunction(() => !document.querySelector(".ck-voicemode")?.open);
    await page.waitForTimeout(300);
    check((await liveTracks(page)) === 0, "End closes the microphone");
    check((await page.evaluate(() => window.__voice.speaking)) === false, "and the voice");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    check(!overflow, "nothing scrolls sideways at 390px");
    await context.close();
  }

  // ── nothing heard, twice ────────────────────────────────────────────────
  {
    const { context, page } = await open("heard=");
    const orb = page.locator(".ck-voicemode-orb");
    for (let i = 0; i < 2; i++) {
      await until(page, "listening");
      await page.waitForTimeout(700);
      await orb.click();
      await page.waitForTimeout(600);
    }
    await until(page, "off");
    check(
      (await page.locator(".ck-voicemode-reason").innerText()).includes("Nothing was heard"),
      "two empty takes close the call, and say why",
    );
    const closed = await page
      .waitForFunction(() => window.__tracks.every((t) => t.readyState !== "live"), null, {
        timeout: 4000,
      })
      .then(() => true)
      .catch(() => false);
    check(closed, "with the microphone closed");
    check(
      (await page.evaluate(() => window.__voice.turns.length)) === 0,
      "and nothing was sent for silence",
    );
    await page.locator(".ck-voicemode-again").click();
    await until(page, "listening");
    check(true, "Talk again reopens it");
    await context.close();
  }

  // ── no answer ───────────────────────────────────────────────────────────
  {
    const { context, page } = await open("answer=");
    await until(page, "listening");
    await page.waitForTimeout(700);
    await page.locator(".ck-voicemode-orb").click();
    await until(page, "off");
    check(
      (await page.locator(".ck-voicemode-reason").innerText()).includes("No answer came"),
      "an answer that never comes ends the call, and says so",
    );
    await context.close();
  }

  // ── a dead transcription ────────────────────────────────────────────────
  {
    const { context, page } = await open("fail=mic", 320);
    await until(page, "listening");
    await page.waitForTimeout(700);
    await page.locator(".ck-voicemode-orb").click();
    await until(page, "off");
    const reason = await page.locator(".ck-voicemode-reason").innerText();
    check(
      reason.trim().length > 10,
      `a failed transcription ends the call in words ("${reason.trim().slice(0, 60)}")`,
    );
    await page.waitForTimeout(300);
    check((await liveTracks(page)) === 0, "with the microphone closed");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    check(!overflow, "nothing scrolls sideways at 320px");
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
console.log("voice mode: all checks passed");
