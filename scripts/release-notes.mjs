import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const leftPad = require("left-pad");

const proofDir = process.env.POC_PROOF_DIR || ".poc-proof";
mkdirSync(proofDir, { recursive: true });

const releaseNumber = process.env.GITHUB_RUN_NUMBER || "local";
const formatted = leftPad(releaseNumber, 8, "0");

const report = {
  message: "Base release notes script executed.",
  releaseNumber,
  formatted,
  markerFilePresent: false,
  note: "If node_modules/left-pad was poisoned by cache, this import already executed cached code."
};

writeFileSync(join(proofDir, "base-release-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Release notes generated for ${formatted}.`);
