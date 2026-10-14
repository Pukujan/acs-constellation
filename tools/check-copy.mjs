#!/usr/bin/env node
// Copy integrity check.
//
// The rule: every user-facing sentence lives in content/. This script fails the
// build when it finds a prose-shaped string literal in src/, when a component
// asks for a copy slot that does not exist, or when the authored copy uses a
// word the writing modules ban outright.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { recordGate, resetGateReport } from "./gate-report.mjs";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const CONTENT = join(ROOT, "content");

// This gate runs first in the chain, so it owns the fresh report.
resetGateReport();

// Vendored shadcn primitives are UI plumbing, not this site's voice.
const SKIP_DIRS = [join(SRC, "components", "ui")];

// Attribute and object keys whose values are never user-facing prose.
const NON_PROSE_KEYS = new Set([
  "className", "class", "style", "id", "key", "ref", "type", "rel", "target",
  "href", "src", "to", "from", "as", "width", "height", "viewBox", "xmlns",
  "fill", "stroke", "d", "points", "transform", "role", "variant", "size",
  "position", "align", "domain", "dataKey", "dataUrl", "nameKey", "labelKey",
  "x", "y", "cx", "cy", "r", "x1", "x2", "y1", "y2", "dx", "dy", "offset",
  "media", "accept", "autoComplete", "placeholderSelector", "event", "path",
  "source", "revision", "kind", "unit", "mode", "scheme", "format", "match",
  "test", "exclude", "include", "layout", "axisLine", "tickLine", "barSize",
  "colorSpace", "blending", "toneMapping", "powerPreference", "mimeType",
  "ariaHidden", "tabIndex", "span", "priority", "wght", "opsz", "family",
]);

const BANNED = [
  "delve", "underscore", "showcase", "pivotal", "tapestry", "testament",
  "intricate", "realm", "meticulous", "vibrant", "palpable", "amidst",
  "multifaceted", "groundbreaking", "boasts", "garner", "bolster", "foster",
  "seamless", "holistic", "paradigm", "transformative", "unprecedented",
  "nuanced", "game-changer", "serves as", "stands as", "plays a key role",
  "it's worth noting", "in today's world", "sheds light on", "paves the way",
  "experts argue", "studies have shown", "highlighting", "underscoring",
  "reflecting the",
];

// Audit voice. The page sells capabilities and cites its figures; a sentence
// whose subject is the page, the source or the survey is a defect, and these
// words are the fingerprint of that voice. `harvest` also catches the slot key
// naming, so the check runs over values only (see copyStrings).
const BANNED_NARRATION = [
  "audit", "harvest", "at that repository", "provenance", "this build",
  "the survey",
];

// Slop vocabulary the marketing skills ban outright. None of these carries a
// meaning the copy needs; each stands in for a fact that should be written out.
const BANNED_SLOP = [
  "synergy", "myriad", "plethora", "embark", "beacon", "utilize",
  "supercharge", "turbocharge", "unleash", "effortless", "in conclusion",
  "let's dive in", "say goodbye to", "unlock the power of",
  "take it to the next level", "ever-evolving", "plays a crucial role",
];

// Fine once, a tell when stacked. Reported, never fatal: failing the build over
// one of these would cost a repair turn for a word that may be the right one.
// `lineage` is here rather than in the bans because it is also the subject of a
// finding, not only narration.
const WARN_WORDS = [
  "robust", "streamline", "empower", "elevate", "harness", "enhance",
  "optimize", "innovative", "revolutionary", "comprehensive", "crucial",
  "vital", "powerful", "world-class", "best-in-class", "lineage", "truly",
  "genuinely", "incredibly", "deeply", "fundamentally", "significantly",
  "literally",
];

const WORD = /^[A-Za-z][A-Za-z'\u2019-]+$/;

function walk(dir, out = []) {
  if (!statSync(dir).isDirectory()) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (SKIP_DIRS.some((skip) => full.startsWith(skip))) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full) && !/\.d\.ts$/.test(full)) out.push(full);
  }
  return out;
}

/** Removes comments without touching string bodies. */
function stripComments(code) {
  let out = "";
  let i = 0;
  let state = "code";
  let quote = "";
  while (i < code.length) {
    const ch = code[i];
    const next = code[i + 1];
    if (state === "code") {
      if (ch === "/" && next === "/") {
        state = "line";
        i += 2;
        continue;
      }
      if (ch === "/" && next === "*") {
        state = "block";
        i += 2;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        state = "string";
        quote = ch;
        out += ch;
        i += 1;
        continue;
      }
      out += ch;
      i += 1;
      continue;
    }
    if (state === "line") {
      if (ch === "\n") {
        state = "code";
        out += ch;
      }
      i += 1;
      continue;
    }
    if (state === "block") {
      if (ch === "*" && next === "/") {
        state = "code";
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    // state === "string"
    if (ch === "\\") {
      out += ch + (next ?? "");
      i += 2;
      continue;
    }
    if (ch === quote) {
      state = "code";
      quote = "";
    }
    out += ch;
    i += 1;
  }
  return out;
}

function isProse(text) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length < 18) return false;
  // Utility class lists, selectors and code fragments carry structure a
  // sentence never has.
  if (/[{}:/\\_]/.test(trimmed)) return false;
  const tokens = trimmed.split(" ");
  if (tokens.length < 4) return false;
  const clean = (token) => token.replace(/[.,;:!?)'"?\u2014]+$/, "");
  const words = tokens.filter((token) => WORD.test(clean(token)));
  // Class names lean on hyphenated compounds; ordinary sentences do not.
  const plain = words.filter((token) => !token.includes("-") && token.length >= 3);
  if (words.length / tokens.length < 0.7) return false;
  return plain.length >= 3;
}

/** Every user-facing string in copy.json, paired with the slot that owns it. */
function copyStrings(value, prefix = "", out = []) {
  if (typeof value === "string") {
    out.push([prefix, value]);
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => copyStrings(item, `${prefix}[${i}]`, out));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      copyStrings(item, prefix ? `${prefix}.${key}` : key, out);
    }
  }
  return out;
}

/** Collects string literals with the attribute or object key that owns them. */
function literals(code) {
  const found = [];
  const re = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
  let match;
  while ((match = re.exec(code)) !== null) {
    const before = code.slice(Math.max(0, match.index - 60), match.index);
    const keyMatch = before.match(/([A-Za-z_$][\w$]*)\s*[:=]\s*$/);
    const owner = keyMatch ? keyMatch[1] : null;
    const value = match[2];
    if (match[1] === "`" && value.includes("${")) continue;
    found.push({ value, owner, index: match.index });
  }
  return found;
}

/** Collects JSX text nodes: the content between a tag close and the next tag open. */
function jsxText(code) {
  const out = [];
  const re = /(^|[^=])>([^<>]+)</g;
  let match;
  while ((match = re.exec(code)) !== null) {
    const raw = match[2].replace(/\{[^{}]*\}/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
    if (isProse(raw)) out.push(raw.trim());
  }
  return out;
}

const problems = [];

// ---------------------------------------------------------------- self-test
// The detector has to prove it works, or a silent regression would let prose
// back into components. A known sentence must be caught and a class string must
// not be.
if (!isProse("Open the map and read the citation at its commit.")) {
  console.error("Copy check aborted: the prose detector no longer catches a sentence.");
  process.exit(1);
}
if (isProse("flex flex-col items-center justify-between")) {
  console.error("Copy check aborted: the prose detector now flags utility classes.");
  process.exit(1);
}
const harvestLine = "Harvested at that repository's commit on 2026-10-13.";
if (!BANNED_NARRATION.some((w) => harvestLine.toLowerCase().includes(w))) {
  console.error("Copy check aborted: the audit-voice detector no longer catches a harvest line.");
  process.exit(1);
}
if (BANNED_NARRATION.some((w) => "One pin lived in thirteen files.".toLowerCase().includes(w))) {
  console.error("Copy check aborted: the audit-voice detector now flags a clean sales line.");
  process.exit(1);
}

// ---------------------------------------------------------------- src scan
for (const file of walk(SRC)) {
  const code = stripComments(readFileSync(file, "utf8"));
  const rel = relative(ROOT, file);

  for (const literal of literals(code)) {
    if (literal.owner && NON_PROSE_KEYS.has(literal.owner)) continue;
    if (isProse(literal.value)) {
      problems.push(
        `${rel}: user-facing sentence outside content/ -> "${literal.value.slice(0, 72)}"`,
      );
    }
  }

  for (const text of jsxText(code)) {
    problems.push(`${rel}: sentence written directly in JSX -> "${text.slice(0, 72)}"`);
  }
}

// ------------------------------------------------------------ slot lookups
const copyRaw = readFileSync(join(CONTENT, "copy.json"), "utf8");
const copy = JSON.parse(copyRaw);
const slots = new Set(Object.keys(copy));

// A repeated key parses fine and silently overwrites the first value, so the
// dead slot would still look present to every reader below.
const seen = new Set();
for (const match of copyRaw.matchAll(/^\s{2}"((?:[^"\\]|\\.)*)"\s*:/gm)) {
  if (seen.has(match[1])) {
    problems.push(`content/copy.json: slot "${match[1]}" is written twice`);
  }
  seen.add(match[1]);
}

for (const file of walk(SRC)) {
  const code = stripComments(readFileSync(file, "utf8"));
  const rel = relative(ROOT, file);
  const re = /\b(?:t|tList)\(\s*"([^"]+)"\s*\)/g;
  let match;
  while ((match = re.exec(code)) !== null) {
    if (!slots.has(match[1])) {
      problems.push(`${rel}: copy slot "${match[1]}" is requested but missing from content/copy.json`);
    }
    if (match[1].endsWith(".body") || match[1].endsWith(".heading")) continue;
  }
}

// -------------------------------------------------- generated slot patterns
const RESEARCH_IDS = ["pcm", "oio", "acs", "cgm", "train"];
const BLOCK_IDS = [
  "intro", "problem", "impact", "answer", "compare", "measure", "boundaries",
  "next", "acs", "oio", "pcm", "cgm", "train",
];

for (const id of RESEARCH_IDS) {
  for (const suffix of ["heading", "body"]) {
    if (!slots.has(`research.${id}.${suffix}`)) {
      problems.push(`content/copy.json: research.${id}.${suffix} is missing`);
    }
  }
  // Every layer pill has to say something; the diagram is the page's argument.
  if (!slots.has(`stack.${id}.heading`)) {
    problems.push(`content/copy.json: stack.${id}.heading is missing`);
  }
}

for (const id of BLOCK_IDS) {
  for (const suffix of ["heading", "body"]) {
    if (!slots.has(`block.${id}.${suffix}`)) {
      problems.push(`content/copy.json: block.${id}.${suffix} is missing`);
    }
  }
}

// Only these four components carry a chart; train carries the gap table.
for (const id of ["pcm", "oio", "acs", "cgm"]) {
  for (const suffix of ["chartTitle", "chartSubtitle", "chartCaption", "chartAlt"]) {
    if (!slots.has(`research.${id}.${suffix}`)) {
      problems.push(`content/copy.json: research.${id}.${suffix} is missing`);
    }
  }
}
for (const suffix of ["tableHeading", "tableNote"]) {
  if (!slots.has(`research.train.${suffix}`)) {
    problems.push(`content/copy.json: research.train.${suffix} is missing`);
  }
}
for (const step of ["demo.step1", "demo.step2", "demo.step3"]) {
  for (const suffix of ["heading", "body"]) {
    if (!slots.has(`${step}.${suffix}`)) {
      problems.push(`content/copy.json: ${step}.${suffix} is missing`);
    }
  }
}
for (const section of [
  "howto", "layers", "edges", "problems", "mechanism", "decisions",
  "parked", "limits", "next",
]) {
  for (const suffix of ["heading", "body"]) {
    if (!slots.has(`prd.${section}.${suffix}`)) {
      problems.push(`content/copy.json: prd.${section}.${suffix} is missing`);
    }
  }
}

// ------------------------------------------------------- slots the app needs
// The page is switched by tabs and walked by layer pills, so those labels are
// part of the contract, not optional decoration.
for (const tab of ["problem", "stack", "research", "demo"]) {
  if (!slots.has(`tabs.${tab}`)) {
    problems.push(`content/copy.json: tabs.${tab} is missing`);
  }
}
for (const slot of [
  "hotloader.name", "hotloader.loads", "hotloader.owns", "hotloader.notOwns",
  "figure.before.label", "figure.before.heading", "figure.after.label",
  "figure.after.heading",
]) {
  if (!slots.has(slot)) {
    problems.push(`content/copy.json: ${slot} is missing`);
  }
}
for (const list of ["figure.before.items", "figure.after.items", "block.boundaries.items"]) {
  const value = copy[list];
  if (!Array.isArray(value) || value.length === 0) {
    problems.push(`content/copy.json: ${list} must be a non-empty list`);
  }
}

// ------------------------------------------------------ banned words in copy
// The whole-document scan above catches a banned word in a slot name too, which
// is why the narration words get their own values-only pass below.
const lower = JSON.stringify(copy).toLowerCase();
for (const word of BANNED) {
  if (lower.includes(word)) {
    problems.push(`content/copy.json: authored copy uses the banned word "${word}"`);
  }
}

// ------------------------------------------- audit voice and slop, by value
const strings = copyStrings(copy);
const warnings = [];

for (const [slot, text] of strings) {
  const value = text.toLowerCase();
  for (const word of BANNED_NARRATION) {
    if (value.includes(word)) {
      problems.push(
        `content/copy.json: ${slot} narrates its own sourcing ("${word}") -> "${text.slice(0, 72)}"`,
      );
    }
  }
  for (const word of BANNED_SLOP) {
    if (value.includes(word)) {
      problems.push(
        `content/copy.json: ${slot} uses the banned word "${word}" -> "${text.slice(0, 72)}"`,
      );
    }
  }
  for (const word of WARN_WORDS) {
    if (new RegExp("\\b" + word + "\\b").test(value)) {
      warnings.push(`${slot}: "${word}" -> "${text.slice(0, 72)}"`);
    }
  }
}

if (warnings.length) {
  console.warn(`\nCopy advisory (${warnings.length}, not fatal):\n`);
  for (const line of warnings) console.warn(`  - ${line}`);
}

if (problems.length) {
  console.error("\nCopy integrity check failed:\n");
  for (const line of problems) console.error(`  - ${line}`);
  console.error(`\n${problems.length} problem(s). Move the sentence into content/copy.json.\n`);
  process.exit(1);
}

const summary =
  `Copy check passed: ${Object.keys(copy).length} slots in content/copy.json, no prose literals in src/` +
  (warnings.length ? `, ${warnings.length} advisory hit(s).` : ".");

console.log(summary);
recordGate("check-copy", summary);
