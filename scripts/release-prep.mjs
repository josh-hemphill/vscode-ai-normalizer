#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { finalizeRelease } from "./changelog-lib.mjs";

const usage = () => {
  console.error("Usage: node scripts/release-prep.mjs <version>");
  console.error("Example: node scripts/release-prep.mjs 0.2.0");
  process.exit(1);
};

const versionArg = process.argv[2];
if (!versionArg || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(versionArg.replace(/^v/, ""))) {
  usage();
}

const version = versionArg.replace(/^v/, "");
const pkgPath = "package.json";
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const previous = pkg.version;

const { releaseBody } = finalizeRelease({ version });

pkg.version = version;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");

console.log(`release-prep: ${previous} → ${version}`);
console.log(`release-prep: updated CHANGELOG.md and package.json`);
if (releaseBody) {
  console.log("\n--- Release notes preview ---\n");
  console.log(releaseBody);
}
console.log(
  "\nNext: commit, tag v" +
    version +
    ", and push. CI will build a pre-release VSIX and GitHub release from CHANGELOG."
);
