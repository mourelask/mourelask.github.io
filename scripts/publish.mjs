// Publish helper: build the site, commit all changes, and push to GitHub.
// Usage: node scripts/publish.mjs "your commit message"
// (Run from VS Code via the "Publish: build, commit & push" task.)
import { spawnSync } from "node:child_process";

const msg = process.argv.slice(2).join(" ").trim() || "Update content";

// git is a real .exe on Windows, so we can pass args without a shell
// (avoids any quoting issues with the commit message). npm is npm.cmd on
// Windows and needs a shell.
function run(cmd, args, { shell = false } = {}) {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  // When using a shell, pass the whole command as one string. Passing an args
  // array together with shell:true triggers Node's DEP0190 warning (args are
  // concatenated, not escaped). git runs without a shell, so it keeps the safe
  // args array — important for the commit message, which may contain spaces.
  const res = shell
    ? spawnSync([cmd, ...args].join(" "), { stdio: "inherit", shell: true })
    : spawnSync(cmd, args, { stdio: "inherit", shell: false });
  if (res.error) throw new Error(`${cmd} not found: ${res.error.message}`);
  if (res.status !== 0) throw new Error(`"${cmd} ${args.join(" ")}" exited with code ${res.status}`);
}

function capture(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: "utf8" });
  return (res.stdout || "").trim();
}

try {
  // 1. Build first so we never push a site that doesn't compile.
  run("npm", ["run", "build"], { shell: true });

  // 2. Stage everything.
  run("git", ["add", "-A"]);

  // 3. Commit only if there is something to commit.
  const dirty = capture("git", ["status", "--porcelain"]);
  if (dirty) {
    run("git", ["commit", "-m", msg]);
  } else {
    console.log("\nNothing new to commit — pushing any pending commits.");
  }

  // 4. Push to the configured remote/branch.
  run("git", ["push"]);

  console.log("\n✓ Published. GitHub Actions will build & deploy shortly.");
} catch (err) {
  console.error(`\n✗ Publish failed: ${err.message}`);
  console.error(
    "\nIf this is your first push, connect the remote once:\n" +
      "  git remote add origin <your-repo-url>\n" +
      "  git push -u origin main\n" +
      "After that, the Publish task works on its own."
  );
  process.exit(1);
}
