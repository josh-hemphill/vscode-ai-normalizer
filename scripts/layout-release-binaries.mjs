import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Copies downloaded CI proxy artifacts into bin/<platform>-<arch>/ for vsce package. */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const artifactsDir = process.argv[2] ?? join(root, "artifacts");

const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!name.startsWith("normalizer-proxy")) {
      continue;
    }
    const platformArch = dirname(full).split(/[/\\]/).pop();
    if (!platformArch?.includes("-")) {
      continue;
    }
    const destDir = join(root, "bin", platformArch);
    mkdirSync(destDir, { recursive: true });
    const dest = join(destDir, name);
    cpSync(full, dest);
    console.log(`layout-release-binaries: ${dest}`);
  }
};

if (existsSync(artifactsDir)) {
  walk(artifactsDir);
} else {
  console.warn(`layout-release-binaries: no artifacts at ${artifactsDir}`);
}
