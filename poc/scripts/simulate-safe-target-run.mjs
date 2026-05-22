import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { printHeader, resetRun, writeEvent } from "./lib.mjs";

printHeader("SAFE: pull_request_target uses authority but does not run PR code");

const runDir = await resetRun("safe-target");
const proofDir = join(runDir, "proof");
await mkdir(proofDir, { recursive: true });

const eventPath = await writeEvent(runDir, {
  action: "opened",
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

const fakeComment = {
  endpoint: "POST /repos/owner/base/issues/42/comments",
  eventName: "pull_request_target",
  eventPath,
  body: "Thanks. A maintainer will review this.",
  fakeGithubTokenPresent: true,
  forkCodeExecuted: false
};

await writeFile(join(proofDir, "safe-comment-payload.json"), `${JSON.stringify(fakeComment, null, 2)}\n`);

console.log("Simulated safe target workflow:");
console.log("  1. on: pull_request_target");
console.log("  2. no checkout of fork PR code");
console.log("  3. no npm install / tests / build");
console.log("  4. privileged action is metadata-only: comment on PR");
console.log("");
console.log("Proof file:");
console.log(JSON.stringify(fakeComment, null, 2));
console.log(`Run directory: ${runDir}`);

