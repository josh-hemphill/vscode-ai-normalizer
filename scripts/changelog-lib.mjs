import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const UNRELEASED_HEADING = "## [Unreleased]";

/** @returns {string | undefined} */
export const lastGitTag = () => {
  try {
    const tag = execSync("git describe --tags --abbrev=0", {
      encoding: "utf8",
    }).trim();
    return tag || undefined;
  } catch {
    return undefined;
  }
};

/** Commits since the latest tag (or all commits if none). */
export const commitsSinceTag = (tag) => {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const raw = execSync(`git log ${range} --pretty=format:%s`, {
    encoding: "utf8",
  }).trim();
  if (!raw) {
    return [];
  }
  return raw.split("\n").filter((line) => line && !line.startsWith("Merge "));
};

const categorizeCommit = (subject) => {
  const lower = subject.toLowerCase();
  if (lower.startsWith("feat")) {
    return "Added";
  }
  if (lower.startsWith("fix")) {
    return "Fixed";
  }
  if (lower.startsWith("security") || lower.includes("security")) {
    return "Security";
  }
  if (
    lower.startsWith("chore(release)") ||
    lower.startsWith("chore: release") ||
    lower === "release prep"
  ) {
    return null;
  }
  return "Changed";
};

/** Groups commit subjects into Keep a Changelog sections. */
export const groupCommits = (subjects) => {
  /** @type {Record<string, string[]>} */
  const sections = {
    Added: [],
    Changed: [],
    Fixed: [],
    Security: [],
  };
  for (const subject of subjects) {
    const bucket = categorizeCommit(subject);
    if (!bucket) {
      continue;
    }
    const bullet = subject.replace(/^(feat|fix|docs|chore|refactor|test)(\([^)]+\))?!?:\s*/i, "- ");
    const line = bullet.startsWith("- ") ? bullet : `- ${subject}`;
    if (!sections[bucket].includes(line)) {
      sections[bucket].push(line);
    }
  }
  return sections;
};

const formatSections = (sections) => {
  const order = ["Added", "Changed", "Fixed", "Security"];
  const parts = [];
  for (const name of order) {
    const items = sections[name];
    if (!items?.length) {
      continue;
    }
    parts.push(`### ${name}`, "", ...items, "");
  }
  return parts.join("\n").trimEnd();
};

/** Parses bullet content under ## [Unreleased]. */
export const parseUnreleasedBody = (changelog) => {
  const start = changelog.indexOf(UNRELEASED_HEADING);
  if (start < 0) {
    return "";
  }
  const after = changelog.slice(start + UNRELEASED_HEADING.length);
  const next = after.search(/\n## \[/);
  const body = next < 0 ? after : after.slice(0, next);
  return body.trim();
};

/** Extracts markdown for a released version (no leading #). */
export const extractVersionSection = (changelog, version) => {
  const escaped = version.replace(/\./g, "\\.");
  const re = new RegExp(
    `## \\[${escaped}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n## \\[|$)`
  );
  const match = changelog.match(re);
  return match?.[1]?.trim() ?? "";
};

const mergeSectionBullets = (manual, generated) => {
  const lines = new Set();
  for (const block of [manual, generated]) {
    for (const line of block.split("\n")) {
      const t = line.trim();
      if (t.startsWith("- ")) {
        lines.add(t);
      }
    }
  }
  return [...lines];
};

const bodyToSections = (body) => {
  /** @type {Record<string, string[]>} */
  const sections = {};
  let current = "";
  for (const line of body.split("\n")) {
    const head = line.match(/^### (.+)$/);
    if (head) {
      current = head[1];
      sections[current] = sections[current] ?? [];
      continue;
    }
    if (current && line.trim().startsWith("- ")) {
      sections[current].push(line.trim());
    }
  }
  return sections;
};

const mergeSections = (a, b) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const key of keys) {
    const merged = mergeSectionBullets(
      (a[key] ?? []).join("\n"),
      (b[key] ?? []).join("\n")
    );
    if (merged.length) {
      out[key] = merged;
    }
  }
  return out;
};

/**
 * Finalizes [Unreleased] into a versioned section and opens a new [Unreleased].
 * @param {{ version: string; date?: string; changelogPath?: string }} opts
 */
export const finalizeRelease = (opts) => {
  const changelogPath = opts.changelogPath ?? "CHANGELOG.md";
  const date =
    opts.date ??
    new Date().toISOString().slice(0, 10);
  const version = opts.version.replace(/^v/, "");
  let changelog = readFileSync(changelogPath, "utf8");

  const tag = lastGitTag();
  const gitSections = groupCommits(commitsSinceTag(tag));
  const manualBody = parseUnreleasedBody(changelog);
  const manualSections = bodyToSections(manualBody);
  const merged = mergeSections(manualSections, gitSections);
  const releaseBody = formatSections(merged);

  const header = `## [${version}] - ${date}`;
  const newUnreleased = `${UNRELEASED_HEADING}\n\n### Added\n\n### Changed\n\n### Fixed\n\n### Security\n\n`;

  const unreleasedStart = changelog.indexOf(UNRELEASED_HEADING);
  if (unreleasedStart < 0) {
    throw new Error(`Missing ${UNRELEASED_HEADING} in ${changelogPath}`);
  }
  const afterUnreleased = changelog.slice(unreleasedStart + UNRELEASED_HEADING.length);
  const nextVersion = afterUnreleased.search(/\n## \[/);
  const tail =
    nextVersion < 0 ? "" : afterUnreleased.slice(nextVersion);

  changelog = [
    "# Changelog",
    "",
    "All notable changes to this project will be documented in this file.",
    "",
    "The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),",
    "and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).",
    "",
    newUnreleased.trimEnd(),
    "",
    header,
    "",
    releaseBody,
    tail.trimStart(),
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .concat("\n");

  writeFileSync(changelogPath, changelog, "utf8");
  return { version, date, releaseBody };
};
