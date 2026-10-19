#!/usr/bin/env node
// Content lock.
//
// The change request for the voidfeed port carried one condition above all others: the
// five bundles in content/ are harvested from the source repositories, every revision in
// them is a real commit, and the port was not allowed to touch a byte of them. It also
// said that if a gate fails because a string moved, the gate gets fixed and the content
// does not.
//
// So this checks the content the only way a build can: it digests each file and compares
// against the recorded value. A single changed character — a reworded sentence, a
// reformatted array, a line ending — produces a different digest and fails the build.
//
// The recorded values are the digests as the change request states them: the leading
// eight hex characters and the trailing five. That is enough to bind a file to its
// recorded state, and on failure the script prints the digest it actually computed, so
// the moved file can be identified and restored rather than guessed at.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { recordGate } from "./gate-report.mjs";

const ROOT = process.cwd();

/** Recorded at 2026-10-13, before the black hole port. */
const LOCKED = {
  "content/copy.json": { head: "15a9a3bd", tail: "9087d" },
  "content/graph.json": { head: "f50658da", tail: "7b962" },
  "content/problems.json": { head: "a18f7bff", tail: "c8ed2" },
  "content/research.json": { head: "da74621c", tail: "efd2e" },
  "content/sources.md": { head: "e7e90589", tail: "404b" },
};

const failures = [];

for (const [file, expected] of Object.entries(LOCKED)) {
  let digest;
  try {
    digest = createHash("sha256").update(readFileSync(join(ROOT, file))).digest("hex");
  } catch (error) {
    failures.push(`${file} cannot be read: ${error.message}`);
    continue;
  }
  if (!digest.startsWith(expected.head) || !digest.endsWith(expected.tail)) {
    failures.push(
      `${file} is not the recorded bundle. Expected ${expected.head}…${expected.tail}, ` +
        `found ${digest.slice(0, 8)}…${digest.slice(-5)}. Restore it; do not edit it to fit.`,
    );
  }
}

if (failures.length) {
  console.error("\nContent lock failed:\n");
  for (const line of failures) console.error(`  - ${line}`);
  console.error("\nThe content bundle is harvested, not authored. It does not change here.\n");
  process.exit(1);
}

const summary = `Content lock passed: ${Object.keys(LOCKED).length} bundles match their recorded digests.`;

console.log(summary);
recordGate("check-content-lock", summary);
