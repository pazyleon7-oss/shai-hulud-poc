import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  copyForkToWorkspace,
  printHeader,
  readProof,
  resetRun,
  runNpmInstall,
  writeEvent
} from "./lib.mjs";

printHeader("SAFER: pull_request runs fork PR code with low authority");

const runDir = await resetRun("normal-pr-ci");
const workspace = await copyForkToWorkspace(runDir);
const proofDir = join(runDir, "proof");
await mkdir(proofDir, { recursive: true });

const eventPath = await writeEvent(runDir, {
  action: "synchronize",
  pull_request: {
    number: 42,
    head: {
      sha: "fork-controlled-sha",
      ref: "feature-from-fork",
      repo: { full_name: "attacker/fork" }
    },
    base: {
      ref: "main",
      repo: { full_name: "owner/base" }
    }
  }
});

const env = {
  ...process.env,
  GITHUB_EVENT_NAME: "pull_request",
  GITHUB_REPOSITORY: "owner/base",
  GITHUB_REF: "refs/pull/42/merge",
  GITHUB_SHA: "merge-test-sha",
  GITHUB_EVENT_PATH: eventPath,
  FAKE_GITHUB_TOKEN: "ghs_fake_read_only_token",
  POC_OUTPUT_DIR: proofDir
};
delete env.FAKE_REPO_SECRET;

console.log("Simulated safe split:");
console.log("  1. on: pull_request");
console.log("  2. checkout PR code");
console.log("  3. run: npm install");
console.log("  4. no fake repo secret is present");
console.log("");

runNpmInstall({ workspace, env });

const proof = await readProof(runDir);
console.log("");
console.log("Proof file:");
console.log(proof || "No proof file found.");
console.log(`Run directory: ${runDir}`);

