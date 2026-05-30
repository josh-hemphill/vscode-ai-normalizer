import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractVersionSection,
  groupCommits,
  parseUnreleasedBody,
} from "./changelog-lib.mjs";

describe("changelog-lib", () => {
  it("parses unreleased body", () => {
    const md = `## [Unreleased]

### Added
- Manual item

## [0.1.0] - 2026-01-01
`;
    assert.match(parseUnreleasedBody(md), /Manual item/);
  });

  it("extracts version section", () => {
    const md = `## [Unreleased]

## [0.1.0] - 2026-01-01

### Added
- First release

## [0.0.1] - 2025-01-01
- Old
`;
    const section = extractVersionSection(md, "0.1.0");
    assert.match(section, /First release/);
    assert.ok(!section.includes("Old"));
  });

  it("groups conventional commits", () => {
    const sections = groupCommits([
      "feat: add proxy",
      "fix: sync guard",
      "chore: lint",
    ]);
    assert.ok(sections.Added.some((l) => l.includes("proxy")));
    assert.ok(sections.Fixed.some((l) => l.includes("sync")));
    assert.ok(sections.Changed.some((l) => l.includes("lint")));
  });
});
