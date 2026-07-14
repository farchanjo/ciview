#!/usr/bin/env bun
/**
 * Bump package.json version (semver).
 * Usage: bun scripts/bump-version.mjs [patch|minor|major|X.Y.Z]
 * Prints the new version (no v-prefix) to stdout.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const pkgPath = resolve(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const arg = (process.argv[2] || process.env.PART || "patch").trim();

function parseSemver(v) {
  const m = String(v).replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!m) throw new Error(`invalid semver in package.json: ${v}`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function format({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

let next;
if (/^\d+\.\d+\.\d+$/.test(arg)) {
  next = arg;
} else {
  const cur = parseSemver(pkg.version);
  if (arg === "major") next = format({ major: cur.major + 1, minor: 0, patch: 0 });
  else if (arg === "minor") next = format({ major: cur.major, minor: cur.minor + 1, patch: 0 });
  else if (arg === "patch") next = format({ major: cur.major, minor: cur.minor, patch: cur.patch + 1 });
  else {
    console.error(`usage: bump-version.mjs [patch|minor|major|X.Y.Z]  (got: ${arg})`);
    process.exit(2);
  }
}

pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(next);
