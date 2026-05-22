import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("..", import.meta.url));
export const runsDir = join(root, ".runs");

export async function resetRun(name) {
  const runDir = join(runsDir, name);
  await rm(runDir, { recursive: true, force: true });
  await mkdir(runDir, { recursive: true });
  return runDir;
}

export async function writeEvent(runDir, event) {
  const eventPath = join(runDir, "event.json");
  await writeFile(eventPath, `${JSON.stringify(event, null, 2)}\n`);
  return eventPath;
}

export async function copyForkToWorkspace(runDir) {
  const workspace = join(runDir, "workspace");
  await cp(join(root, "fork-pr"), workspace, { recursive: true });
  return workspace;
}

export function runNpmInstall({ workspace, env }) {
  execFileSync("npm", ["install", "--ignore-scripts=false", "--fund=false", "--audit=false"], {
    cwd: workspace,
    stdio: "inherit",
    env
  });
}

export async function readProof(runDir) {
  const proofPath = join(runDir, "proof", "attacker-code-ran.json");
  try {
    return await readFile(proofPath, "utf8");
  } catch {
    return "";
  }
}

export function printHeader(title) {
  console.log("");
  console.log("=".repeat(title.length));
  console.log(title);
  console.log("=".repeat(title.length));
}

