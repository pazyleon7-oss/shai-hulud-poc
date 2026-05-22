import { rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
await rm(join(root, ".runs"), { recursive: true, force: true });
console.log("Removed .runs/");

