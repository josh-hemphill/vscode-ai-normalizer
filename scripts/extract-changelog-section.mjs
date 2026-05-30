#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { extractVersionSection } from "./changelog-lib.mjs";

const version = process.argv[2]?.replace(/^v/, "");
if (!version) {
  console.error("Usage: node scripts/extract-changelog-section.mjs <version>");
  process.exit(1);
}

const changelog = readFileSync("CHANGELOG.md", "utf8");
const section = extractVersionSection(changelog, version);
if (!section) {
  console.error(`No CHANGELOG section found for version ${version}`);
  process.exit(1);
}

process.stdout.write(`${section}\n`);
