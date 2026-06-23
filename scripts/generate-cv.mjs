// Render the /cv page to a PDF using headless Chromium (Playwright).
// Assumes the site is already built (run via `npm run cv`, which builds first).
// Output: public/Konstantinos_Mourelas_CV.pdf  (committed + served + deployed).
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";

const PORT = 4329;
const URL = `http://localhost:${PORT}/cv`;
const OUT = path.resolve("public/Konstantinos_Mourelas_CV.pdf");
const astroBin = path.resolve("node_modules/astro/astro.js");

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
  browser = await chromium.launch();
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
