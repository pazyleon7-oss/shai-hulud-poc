import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const proofDir = process.env.POC_PROOF_DIR || ".poc-proof";
mkdirSync(proofDir, { recursive: true });

const proof = {
  message: "Base release reporter executed.",
  eventName: process.env.GITHUB_EVENT_NAME || "",
  fakeSecretPresent: Boolean(process.env.POC_FAKE_SECRET),
  fakeSecretLength: process.env.POC_FAKE_SECRET?.length || 0,
  note: "This is the expected safe fallback when no cached reporter exists."
};

writeFileSync(join(proofDir, "base-release-report.json"), `${JSON.stringify(proof, null, 2)}\n`);
console.log("Base release reporter executed.");
