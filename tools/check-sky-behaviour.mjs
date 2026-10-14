#!/usr/bin/env node
// Sky behaviour check.
//
// The tap gate proves a star can be hit. This proves the other three things the
// owner asked the sky to do, from the same numbers the scene runs on:
//
//   1. no two stars move together,
//   2. a picked star ends up facing the reader, with the middle of the sky behind
//      it, and the framing distance survives the camera's own clamp,
//   3. the edge of the canvas belongs to the page, at every size it is drawn,
//   4. the hero opens closer than the framing it replaced,
//   5. the hotloader pulses no harder than the painted one it replaced, slows down
//      rather than freezing under reduced motion, and hands the frame back to the
//      plain render path when there is no hole to bend light around.
//
// Every constant is read out of the source that uses it, so a change to the scene
// has to be a change to this gate as well.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { recordGate } from "./gate-report.mjs";

const ROOT = process.cwd();
const SKY = join(ROOT, "src/lib/sky.ts");
const CONSTELLATION = join(ROOT, "src/components/Constellation.tsx");
const BLACKHOLE = join(ROOT, "src/lib/blackhole.ts");
const HERO = join(ROOT, "src/components/HeroSky.tsx");

function grab(file, re, label, group = 1) {
  const match = readFileSync(file, "utf8").match(re);
  if (!match) throw new Error(`Sky check aborted: ${label} moved out of ${file}.`);
  return match[group];
}

const num = (file, re, label) => Number(grab(file, re, label));

const problems = JSON.parse(
  readFileSync(join(ROOT, "content/problems.json"), "utf8"),
).problems;
const layers = JSON.parse(
  readFileSync(join(ROOT, "content/graph.json"), "utf8"),
).layers.map((l) => l.component);

/* --------------------------------------------------------------- the scene */

const ORBIT_RADIUS = num(SKY, /const ORBIT_RADIUS = ([\d.]+);/, "ORBIT_RADIUS");
const LAYER_LIFT = grab(SKY, /const LAYER_LIFT = \[([-\d.,\s]+)\]/, "LAYER_LIFT")
  .split(",")
  .map((v) => Number(v.trim()));
const SQUASH = num(SKY, /const squash = orbiting \? ([\d.]+)/, "the orbiting squash");
const SPREAD = num(SKY, /const spread = \(orbiting \? ([\d.]+)/, "the cluster spread");
const SPREAD_PER_NODE = num(SKY, /group\.length \* ([\d.]+)/, "the spread per problem");
const GOLDEN = num(SKY, /const golden = i \* ([\d.]+);/, "the golden angle");
const LIFT_BASE = num(SKY, /lift \* \(([\d.]+) \+ jitter/, "the vertical lift");
const LIFT_JITTER = num(SKY, /lift \* \([\d.]+ \+ jitter \* ([\d.]+)\)/, "the lift jitter");
const Z_JITTER = num(SKY, /radius \* 0\.82 - jitter \* ([\d.]+)/, "the depth jitter");

const HIT_RADIUS = num(CONSTELLATION, /const HIT_RADIUS = ([\d.]+);/, "HIT_RADIUS");
const MIN_HIT_ANGULAR = num(CONSTELLATION, /const MIN_HIT_ANGULAR = ([\d.]+);/, "MIN_HIT_ANGULAR");
const FOV = num(CONSTELLATION, /new THREE\.PerspectiveCamera\(\s*(\d+)/, "the camera field of view");
const FRAME_FACTOR = num(
  CONSTELLATION,
  /const FRAME_DISTANCE_FACTOR = ([\d.]+);/,
  "FRAME_DISTANCE_FACTOR",
);
const MIN_DISTANCE_FACTOR = num(
  CONSTELLATION,
  /controls\.minDistance = homeDistance \* ([\d.]+);/,
  "the camera's closest allowed distance",
);
const GESTURE_EDGE = num(CONSTELLATION, /const GESTURE_EDGE = ([\d.]+);/, "GESTURE_EDGE");
const GESTURE_EDGE_PX = num(CONSTELLATION, /const GESTURE_EDGE_PX = (\d+);/, "GESTURE_EDGE_PX");
const HOME = num(HERO, /homeDistance=\{([\d.]+)\}/, "the hero camera distance");

/** The framing this replaced. The hero is meant to open nearer, not further. */
const PREVIOUS_HOME = 26;

function hash(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/** Mirrors buildProblemSky(orbiting = true). */
function layout() {
  const byCluster = new Map();
  for (const p of problems) {
    const key = p.answeredBy[0];
    byCluster.set(key, [...(byCluster.get(key) ?? []), p]);
  }
  const out = [];
  for (const [cluster, group] of byCluster) {
    const i = Math.max(0, layers.indexOf(cluster));
    const angle = (i / layers.length) * Math.PI * 2 - Math.PI / 2;
    const ax = Math.cos(angle) * ORBIT_RADIUS;
    const az = Math.sin(angle) * ORBIT_RADIUS * SQUASH;
    const ay = LAYER_LIFT[i % LAYER_LIFT.length] * 0.55;
    const spread = SPREAD + group.length * SPREAD_PER_NODE;
    group.forEach((p, j) => {
      const golden = j * GOLDEN;
      const jitter = hash(p.id);
      const lift = group.length === 1 ? 0 : (j / (group.length - 1) - 0.5) * 2;
      const radius = spread * (0.62 + jitter * 0.5);
      out.push({
        id: p.id,
        cluster,
        position: [
          ax + Math.cos(golden) * radius,
          ay + lift * (LIFT_BASE + jitter * LIFT_JITTER),
          az + Math.sin(golden) * radius * 0.82 - jitter * Z_JITTER,
        ],
      });
    });
  }
  return out;
}

/**
 * Mirrors the per-star motion table in Constellation.tsx. The source of truth is
 * that object literal, so a star that stops moving on its own fails this gate.
 */
const MOTION_BODY = grab(
  CONSTELLATION,
  /motion\.set\(id, \{([\s\S]*?)\n {6}\}\);/,
  "the per-star motion table",
);
const makeMotion = new Function("id", "hash", `return {${MOTION_BODY}};`);

/* ------------------------------------------------------------------ checks */

const failures = [];

/* 1. Independent motion. */

/**
 * What "independent" has to mean to be checkable. Over a few seconds every star
 * is drifting slowly, so two stars can share a trend and still not be moving
 * together. What matters, and what the owner asked for, is that neighbours are
 * not locked: at a given instant they are mostly going opposite ways, no two
 * share a clock, and a cluster's speeds are spread rather than uniform.
 */
const nodes = layout();
const SERIES = nodes.map((n) => {
  const m = makeMotion(n.id, hash);
  return { id: n.id, cluster: n.cluster, m };
});

const seen = new Set();
for (const s of SERIES) {
  const key = `${s.m.ay.toFixed(6)}:${s.m.sy.toFixed(6)}:${s.m.py.toFixed(6)}`;
  if (seen.has(key)) failures.push(`${s.id} shares its vertical clock with another star`);
  seen.add(key);
}

/** Same-cluster pairs: the neighbours a reader actually sees side by side. */
function neighbourPairsOf(series) {
  const out = [];
  for (const a of series) {
    for (const b of series) {
      if (a.id >= b.id || a.cluster !== b.cluster) continue;
      out.push([a, b]);
    }
  }
  return out;
}

const neighbourPairs = neighbourPairsOf(SERIES);
if (neighbourPairs.length === 0) {
  failures.push("no two problems share a cluster, so this check measured nothing");
}

/** The share of neighbours going opposite ways, at each of twelve instants. */
function disagreement(series) {
  const pairs = neighbourPairsOf(series);
  if (pairs.length === 0) return 0;
  let total = 0;
  for (let step = 0; step < 12; step += 1) {
    const t = (step / 12) * 8;
    let opposed = 0;
    for (const [a, b] of pairs) {
      const ya = Math.sin(t * a.m.sy + a.m.py) * a.m.ay;
      const yb = Math.sin(t * b.m.sy + b.m.py) * b.m.ay;
      if (Math.sign(ya) !== Math.sign(yb)) opposed += 1;
    }
    total += opposed / pairs.length;
  }
  return total / 12;
}

const opposed = disagreement(SERIES);
if (opposed < 0.4) {
  failures.push(
    `neighbouring stars move against each other only ${(opposed * 100).toFixed(0)}% of the ` +
      `time, which is a sky moving in step`,
  );
}

/**
 * Across the whole sky the drift rates have to be spread, not one speed with
 * small nudges. A two-star cluster cannot prove that on its own, so this is
 * measured over every star rather than pair by pair.
 */
const speeds = SERIES.map((s) => s.m.sy);
const speedRange = Math.max(...speeds) / Math.min(...speeds);
if (speedRange < 2) {
  failures.push(
    `every star drifts at nearly the same rate (fastest to slowest ${speedRange.toFixed(2)}x)`,
  );
}

// A gate that cannot fail is not a gate: one shared clock must read as lockstep.
const welded = SERIES.map((s, i) => ({
  ...s,
  m: { ...s.m, sy: SERIES[0].m.sy, py: SERIES[0].m.py },
  index: i,
}));
if (disagreement(welded) > 0.1) {
  console.error("Sky check aborted: a single shared clock does not read as lockstep.");
  process.exit(1);
}

/* 2. Framing a picked star. */

const frameDistance = HOME * FRAME_FACTOR;
const clamp = HOME * MIN_DISTANCE_FACTOR;
if (frameDistance < clamp) {
  failures.push(
    `a framed star sits ${frameDistance.toFixed(2)} units away, but the camera will not ` +
      `come closer than ${clamp.toFixed(2)}, so it would be pushed back out`,
  );
}

let behind = 0;
for (const n of nodes) {
  const star = n.position;
  const dir = [star[0], star[1], star[2]];
  const len = Math.hypot(...dir) || 1;
  const camera = star.map((v, i) => v + (dir[i] / len) * frameDistance);
  // The middle of the sky has to end up on the far side of the star.
  const toCentre = dir.map((v) => -v);
  const fromStar = camera.map((v, i) => v - star[i]);
  const dot = toCentre.reduce((s, v, i) => s + v * fromStar[i], 0);
  if (dot < 0) behind += 1;
}
if (behind !== nodes.length) {
  failures.push(
    `${nodes.length - behind} of ${nodes.length} stars would be framed with the middle of ` +
      `the sky in front of them instead of behind`,
  );
}

/* 3. The page keeps the edge of the canvas. */

for (const [w, h] of [
  [390, 844],
  [768, 1024],
  [1440, 900],
]) {
  const bandX = Math.max(w * GESTURE_EDGE, GESTURE_EDGE_PX);
  const bandY = Math.max(h * GESTURE_EDGE, GESTURE_EDGE_PX);
  const zoneW = w - bandX * 2;
  const zoneH = h - bandY * 2;
  if (bandX < 40 || bandY < 40) {
    failures.push(
      `at ${w}x${h} the page only gets ${bandX.toFixed(0)}px along the edge of the canvas`,
    );
  }
  if (zoneW < w * 0.5 || zoneH < h * 0.5) {
    failures.push(`at ${w}x${h} the sky's own gesture zone is under half the canvas`);
  }
}

/* 4. The hero opens closer than the framing it replaced. */

/**
 * How much of the viewport width the layer ring spans, seen from home. This is
 * the number behind "the sky should fill the frame": it is what a reader sees
 * before they touch anything, and it does not saturate when stars leave the
 * edges the way a bounding box of visible stars would.
 */
function frameFill(home, aspect = 1440 / 900) {
  const halfFovX = Math.atan(Math.tan((FOV * Math.PI) / 360) * aspect);
  return Math.min(1, Math.atan(ORBIT_RADIUS / home) / halfFovX);
}

if (HOME >= PREVIOUS_HOME) {
  failures.push(
    `the hero opens at ${HOME} units, no closer than the ${PREVIOUS_HOME} it replaced`,
  );
}
const before = frameFill(PREVIOUS_HOME);
const after = frameFill(HOME);
const gain = after / (before || 1);
if (gain < 1.2) {
  failures.push(
    `the new hero framing fills ${(after * 100).toFixed(0)}% of the viewport width against ` +
      `${(before * 100).toFixed(0)}% before, which is not a visible change`,
  );
}

/* 5. The hotloader pulses no harder than the one it replaced, and the bend is off
 *      when there is nothing to bend around.
 *
 *    The painted hotloader modulated its ring alpha by `0.85 + uPulse * 0.2`, so no
 *    part of it rose more than 23.5% above its resting level. The ported hole has six
 *    layers that can each breathe, and a screen-space pass that costs a full frame, so
 *    both halves are worth holding: nothing may pulse harder than the painted one did,
 *    and the pass must go quiet and hand the frame back to the plain render path when
 *    there is no hole on screen.
 */
const PAINTED_BASE = 0.85;
const PAINTED_SWING = 0.2;
const PAINTED_PULSE = PAINTED_SWING / PAINTED_BASE;

const pulseTerms = [
  [/this\.rimMaterial\.uniforms\.uIntensity\.value =\s*([\d.]+) \+ pulse \* ([\d.]+);/, "the rim"],
  [/this\.photonMaterial\.opacity = ([\d.]+) \+ pulse \* ([\d.]+);/, "the photon ring"],
  [/spec\.opacity \* \(([\d.]+) \+ pulse \* ([\d.]+)\)/, "the halos"],
].map(([re, label]) => {
  const match = readFileSync(BLACKHOLE, "utf8").match(re);
  if (!match) throw new Error(`Sky check aborted: ${label}'s pulse moved out of ${BLACKHOLE}.`);
  return { label, ratio: Number(match[2]) / Number(match[1]) };
});

for (const term of pulseTerms) {
  if (term.ratio > PAINTED_PULSE + 1e-6) {
    failures.push(
      `${term.label} rises ${(term.ratio * 100).toFixed(1)}% over its resting level while ` +
        `pulsing, past the ${(PAINTED_PULSE * 100).toFixed(1)}% the painted hotloader allowed`,
    );
  }
}

/** The whole assembly also swells. That is a size change, not a brightness strobe. */
const BREATHE = num(
  BLACKHOLE,
  /const breathe = 1 \+ Math\.sin\(t \* [\d.]+\) \* ([\d.]+);/,
  "the assembly's swell",
);
if (BREATHE > 0.02) {
  failures.push(`the hole swells by ${(BREATHE * 100).toFixed(1)}% per breath, which reads as a strobe`);
}

/* Reduced motion has to slow the hole down, not stop drawing it. */
const reducedMatch = readFileSync(CONSTELLATION, "utf8").match(
  /blackHole\.update\(delta \* \(reduced \? ([\d.]+) : ([\d.]+)\)\)/,
);
if (!reducedMatch) {
  throw new Error(
    `Sky check aborted: the hotloader no longer advances through one scaled call in ${CONSTELLATION}, ` +
      `so reduced motion cannot be checked.`,
  );
}
const reducedFactor = Number(reducedMatch[1]);
const normalFactor = Number(reducedMatch[2]);
if (reducedFactor <= 0) {
  failures.push("reduced motion stops the hotloader advancing, so the hole would freeze instead of slowing");
}
if (reducedFactor >= normalFactor) {
  failures.push("reduced motion does not slow the hotloader's own motion");
}

/* The pass has to hand the frame back when there is no hole. */
const quietPath = readFileSync(CONSTELLATION, "utf8").match(
  /uniforms\.uActive\.value = 0;[\s\S]{0,400}renderer\.render\(scene, camera\);/,
);
if (!quietPath) {
  failures.push(
    "with no hole on screen the lensing pass is not forced to uActive 0 and the frame is not " +
      "rendered by the plain path, so a sky without a hotloader would still pay for the pass",
  );
}

/* ------------------------------------------------------------------ verdict */

if (failures.length) {
  console.error("\nSky behaviour check failed:\n");
  for (const line of failures) console.error(`  - ${line}`);
  console.error("\nThe sky has to behave, not only appear.\n");
  process.exit(1);
}

const skySummary =
  `Sky check passed: ${neighbourPairs.length} neighbour pairs disagree ` +
  `${(opposed * 100).toFixed(0)}% of the time; ` +
  `a framed star sits ${frameDistance.toFixed(1)} units out with the sky behind it; ` +
  `the page keeps a ${Math.max(390 * GESTURE_EDGE, GESTURE_EDGE_PX).toFixed(0)}px edge at 390 wide; ` +
  `the hero ring fills ${(after * 100).toFixed(0)}% of the desktop viewport against ` +
  `${(before * 100).toFixed(0)}% at the framing it replaced; ` +
  `the hole pulses at most ${(Math.max(...pulseTerms.map((p) => p.ratio)) * 100).toFixed(1)}% ` +
  `against the painted ${(PAINTED_PULSE * 100).toFixed(1)}%, swells ${(BREATHE * 100).toFixed(1)}% ` +
  `per breath, runs at 1/${(normalFactor / reducedFactor).toFixed(1)} speed under reduced motion, ` +
  `and hands the frame back to the plain render path when there is no hole.`;

console.log(skySummary);
recordGate("check-sky-behaviour", skySummary);
