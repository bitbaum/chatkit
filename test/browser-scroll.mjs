import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import assert from "node:assert/strict";

const root = fileURLToPath(new URL("..", import.meta.url));
const server = createServer(async (req, res) => {
  const path = normalize(join(root, new URL(req.url, "http://localhost").pathname));
  if (!path.startsWith(root)) return res.writeHead(403).end();
  try {
    res
      .writeHead(200, {
        "content-type":
          { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[extname(path)] ??
          "application/octet-stream",
      })
      .end(await readFile(path));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
try {
  for (const width of [390, 1280])
    for (const owner of ["page", "panel", "ancestor"]) {
      const page = await browser.newPage({
        viewport: { width, height: 844 },
        hasTouch: width === 390,
        isMobile: width === 390,
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`http://localhost:${server.address().port}/demo/scroll.html?owner=${owner}`);
      await page.waitForSelector(".ck-live");
      await page.waitForTimeout(400);
      const position = () =>
        page.evaluate((mode) => {
          const el =
            mode === "page"
              ? document.scrollingElement
              : mode === "panel"
                ? document.querySelector(".ck-thread")
                : document.querySelector("#fixture-owner");
          return { top: el.scrollTop, height: el.scrollHeight, client: el.clientHeight };
        }, owner);
      const start = await position();
      assert.ok(start.top > 100, `${owner} ${width}: starts at latest turn`);
      await page.mouse.move(width / 2, 400);
      await page.mouse.wheel(0, -450);
      await page.waitForTimeout(150);
      const reading = await position();
      assert.ok(reading.top < start.top - 200, `${owner} ${width}: can scroll upward`);
      await page.waitForTimeout(700);
      assert.ok(
        Math.abs((await position()).top - reading.top) < 3,
        `${owner} ${width}: status ticks must not steal reading position`,
      );
      await page.evaluate(() => document.querySelector("#assistant-turn").click());
      await page.waitForTimeout(350);
      assert.ok(
        Math.abs((await position()).top - reading.top) < 3,
        `${owner} ${width}: completed assistant turn must not steal reading position`,
      );
      await page.setViewportSize({ width, height: 760 });
      await page.waitForTimeout(300);
      assert.ok(
        (await position()).top < start.top - 150,
        `${owner} ${width}: resize respects reading`,
      );
      // Sending a new question is an explicit request to follow the new reply.
      await page.evaluate(() => document.querySelector("#user-turn").click());
      await page.waitForTimeout(350);
      const sent = await position();
      assert.ok(
        sent.top > reading.top + 200,
        `${owner} ${width}: own new question resumes following`,
      );
      await page.mouse.wheel(0, -25);
      await page.waitForTimeout(500);
      assert.ok(
        (await position()).top < sent.top - 10,
        `${owner} ${width}: even a small upward gesture pauses following`,
      );
      await page.evaluate(() => document.querySelector(".ck-jump").click());
      await page.waitForTimeout(650);
      const jumped = await position();
      assert.ok(
        jumped.top > (await position()).top - 3 && jumped.top > reading.top + 200,
        `${owner} ${width}: return-to-latest works`,
      );
      if (width === 390) {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: width / 2, y: 180 }],
        });
        for (let y = 210; y <= 570; y += 30) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: width / 2, y }],
          });
          await page.waitForTimeout(25);
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForTimeout(450);
        assert.ok(
          (await position()).top < jumped.top - 100,
          `${owner}: upward touch gesture remains free while statuses change (${jumped.top} -> ${(await position()).top})`,
        );
        await cdp.detach();
      }
      await page.locator(".ck-input").fill("A pending synthetic question.");
      await page.locator(".ck-input").press("Enter");
      await page.waitForFunction(
        () => document.getElementById("fixture-sending").textContent === "true",
      );
      await page.mouse.move(width / 2, 400);
      await page.mouse.wheel(0, -420);
      await page.waitForTimeout(400);
      const pendingReading = await position();
      await page.evaluate(() => document.getElementById("finish-send").click());
      await page.waitForFunction(() => document.querySelector(".ck-input").value === "");
      await page.waitForTimeout(400);
      assert.ok(
        Math.abs((await position()).top - pendingReading.top) < 4,
        `${owner} ${width}: reply completion and focused draft clear preserve reading`,
      );
      assert.deepEqual(errors, [], `${owner} ${width}: no browser errors`);
      await page.close();
      console.log(
        `PASS ${owner} ${width}: streaming, completed turn, resize, own send and small upward gesture`,
      );
    }
} finally {
  await browser.close();
  server.close();
}
