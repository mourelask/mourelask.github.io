// Render the /cv page to a PDF using headless Chromium (Playwright).
// Assumes the site is already built (run via `npm run cv`, which builds first).
// Output: public/Konstantinos_Mourelas_CV.pdf  (committed + served + deployed).
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = 4329;
const URL = `http://localhost:${PORT}/cv`;
const OUT = path.resolve("public/Konstantinos_Mourelas_CV.pdf");
const astroBin = path.resolve("node_modules/astro/astro.js");

// Find the on-disk Chromium that Playwright downloaded, and launch it directly.
// Playwright's own browser-path resolution can fail in some shells (e.g. the
// VS Code task) even when the browser is installed; pointing at the executable
// explicitly sidesteps that entirely.
function findBrowserExecutable() {
  const base =
    process.env.PLAYWRIGHT_BROWSERS_PATH &&
    process.env.PLAYWRIGHT_BROWSERS_PATH !== "0"
      ? process.env.PLAYWRIGHT_BROWSERS_PATH
      : path.join(os.homedir(), "AppData", "Local", "ms-playwright");
  if (!fs.existsSync(base)) return null;
  const candidates = [];
  for (const dir of fs.readdirSync(base)) {
    if (dir.startsWith("chromium_headless_shell-")) {
      candidates.push(
        path.join(base, dir, "chrome-headless-shell-win64", "chrome-headless-shell.exe")
      );
    }
    if (dir.startsWith("chromium-")) {
      candidates.push(path.join(base, dir, "chrome-win", "chrome.exe"));
    }
  }
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const r = await fetch(url);
        if (r.ok) return resolve();
      } catch {
        /* server not up yet */
      }
      if (Date.now() - start > timeoutMs) {
        return reject(new Error("preview server did not start in time"));
      }
      setTimeout(tick, 400);
    };
    tick();
  });
}

// Serve the built site so Chromium can render /cv with correct asset paths.
const server = spawn(
  process.execPath,
  [astroBin, "preview", "--port", String(PORT)],
  { stdio: "ignore" }
);

let browser;
try {
  await waitForServer(URL);
  const executablePath = findBrowserExecutable();
  if (executablePath) console.log(`Using browser: ${executablePath}`);
  browser = await chromium.launch(
    executablePath ? { executablePath } : {}
  );
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.pdf({
    path: OUT,
    format: "A4",
    printBackground: true,
    margin: { top: "14mm", bottom: "14mm", left: "14mm", right: "14mm" },
  });
  console.log(`✓ CV PDF written to ${OUT}`);
} catch (err) {
  console.error(`✗ CV generation failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
}
