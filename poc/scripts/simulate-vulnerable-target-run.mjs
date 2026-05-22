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

printHeader("VULNERABLE: pull_request_target executes fork PR code");

const runDir = await resetRun("vulnerable-target");
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
  GITHUB_EVENT_NAME: "pull_request_target",
  GITHUB_REPOSITORY: "owner/base",
  GITHUB_REF: "refs/heads/main",
  GITHUB_SHA: "base-default-branch-sha",
  GITHUB_EVENT_PATH: eventPath,
  FAKE_GITHUB_TOKEN: "ghs_fake_write_token_from_base_repo_context",
  FAKE_REPO_SECRET: "fake_PROD_DATABASE_URL_or_registry_token",
  POC_OUTPUT_DIR: proofDir
};

console.log("Simulated workflow mistake:");
console.log("  1. on: pull_request_target");
console.log("  2. checkout ref: github.event.pull_request.head.sha");
console.log("  3. run: npm install");
console.log("");

runNpmInstall({ workspace, env });

const proof = await readProof(runDir);
console.log("");
console.log("Proof file:");
console.log(proof || "No proof file found.");
console.log(`Run directory: ${runDir}`);

