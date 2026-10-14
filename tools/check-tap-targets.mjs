#!/usr/bin/env node
// Tap-target check.
//
// The sky is the only way to reach a failure from the front page, so a star has
// to be big enough for a thumb. This projects the real layout through the real
// hero camera at a 390x844 viewport, all the way round the sky's turn, and fails
// the build when a star stops being tappable.
//
// Two things make a star untappable: a pick target too small to land on, and a
// star that sits behind a nearer star's pick target at every angle it can be
// seen from. Overlap at some angles is fine, because the sky turns and the
// raycaster takes whatever is nearest.
//
// The placement maths mirrors buildProblemSky in src/lib/sky.ts. Every number it
// needs is read out of the source rather than repeated here, so changing the
// scene has to be a deliberate change to this gate as well.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { recordGate } from "./gate-report.mjs";

const ROOT = process.cwd();
const SKY = join(ROOT, "src/lib/sky.ts");
const CONSTELLATION = join(ROOT, "src/components/Constellation.tsx");
const SKIES = join(ROOT, "src/components/Skies.tsx");
const HERO = join(ROOT, "src/components/HeroSky.tsx");

function grab(file, re, label, group = 1) {
  const match = readFileSync(file, "utf8").match(re);
  if (!match) throw new Error(`Tap check aborted: ${label} moved out of ${file}.`);
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
/*
 * The vertical lift and the depth jitter used to be repeated here, which meant
 * this gate could quietly measure a sky that no longer exists. They are read out
 * of the layout now, like every other number.
 */
const LIFT_BASE = num(SKY, /lift \* \(([\d.]+) \+ jitter/, "the vertical lift");
const LIFT_JITTER = num(SKY, /lift \* \([\d.]+ \+ jitter \* ([\d.]+)\)/, "the lift jitter");
const Z_JITTER = num(SKY, /radius \* 0\.82 - jitter \* ([\d.]+)/, "the depth jitter");
const NODE_BASE = num(SKIES, /size: ([\d.]+) \+ n\.problem\.evidence\.length/, "the node size floor");
const NODE_PER_EVIDENCE = num(SKIES, /evidence\.length \* ([\d.]+)/, "the node size per citation");
const HIT_RADIUS = num(CONSTELLATION, /const HIT_RADIUS = ([\d.]+);/, "HIT_RADIUS");
const MIN_HIT_ANGULAR = num(
  CONSTELLATION,
  /const MIN_HIT_ANGULAR = ([\d.]+);/,
  "MIN_HIT_ANGULAR",
);
const FOV = num(CONSTELLATION, /new THREE\.PerspectiveCamera\(\s*(\d+)/, "the camera field of view");
const SINK = num(CONSTELLATION, /baseY = sinkOnNarrow && w < 640 \? (-?[\d.]+)/, "the narrow-screen sink");
const HOME = num(HERO, /homeDistance=\{([\d.]+)\}/, "the hero camera distance");

/** The phone this is written against, and the smallest target that clears it. */
const W = 390;
const H = 844;
/*
 * 30px of radius is a 60px disc, which is about the width of a thumb print on
 * this screen. The floor used to be 20; the owner asked for a sky a two-year-old
 * could poke, so the gate now demands more, not less.
 */
const MIN_PICK_PX = 30;
const TURNS = 72;

function hash(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/** Mirrors buildProblemSky(orbiting = true) plus the node sizes in Skies.tsx. */
function layout(nodes) {
  const byCluster = new Map();
  for (const p of nodes) {
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
        size: NODE_BASE + p.evidence.length * NODE_PER_EVIDENCE,
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

/* ------------------------------------------------------------- the camera */

const CAMERA = [HOME * 0.055, HOME * 0.12, HOME];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function unit(v) {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
}

const FORWARD = unit(CAMERA.map((v) => -v));
const RIGHT = unit(cross(FORWARD, [0, 1, 0]));
const UP = cross(RIGHT, FORWARD);
const TAN = Math.tan((FOV * Math.PI) / 360);
const ASPECT = W / H;

/** Screen position, depth and pick radius in pixels, for stars inside the frame. */
function visibleStars(nodes, rotation) {
  const points = [];
  for (const n of nodes) {
    const [x, y, z] = n.position;
    const world = [
      x * Math.cos(rotation) + z * Math.sin(rotation),
      y + SINK,
      -x * Math.sin(rotation) + z * Math.cos(rotation),
    ];
    const d = world.map((v, i) => v - CAMERA[i]);
    const depth = dot(d, FORWARD);
    if (depth <= 0.1) continue;
    const ndcX = dot(d, RIGHT) / (depth * TAN * ASPECT);
    const ndcY = dot(d, UP) / (depth * TAN);
    if (Math.abs(ndcX) > 1 || Math.abs(ndcY) > 1) continue;
    points.push({
      id: n.id,
      x: ((ndcX + 1) / 2) * W,
      y: ((1 - ndcY) / 2) * H,
      depth,
      r:
        (Math.max(n.size * HIT_RADIUS, Math.hypot(...d) * MIN_HIT_ANGULAR) /
          (depth * TAN)) *
        (H / 2),
    });
  }
  return points;
}

function survey(nodes) {
  let smallest = { r: Infinity };
  let closest = { gap: Infinity };
  const sightings = new Map();
  const hidden = new Map();
  let positions = 0;

  for (let step = 0; step < TURNS; step += 1) {
    const points = visibleStars(nodes, (step / TURNS) * Math.PI * 2);
    positions += points.length;
    for (const p of points) {
      sightings.set(p.id, (sightings.get(p.id) ?? 0) + 1);
      if (p.r < smallest.r) smallest = { r: p.r, id: p.id };
    }
    for (const a of points) {
      for (const b of points) {
        if (a.id === b.id) continue;
        const gap = Math.hypot(a.x - b.x, a.y - b.y);
        if (a.id < b.id && gap < closest.gap) closest = { gap, a: a.id, b: b.id };
        // Only a nearer star can steal this tap.
        if (gap < b.r && b.depth < a.depth) {
          hidden.set(a.id, (hidden.get(a.id) ?? 0) + 1);
        }
      }
    }
  }

  const buried = [...sightings].find(
    ([id, times]) => (hidden.get(id) ?? 0) >= times,
  );
  return { smallest, closest, sightings, buried, hidden, positions };
}

/* ---------------------------------------------------------------- self-test */
// A gate that cannot fail is not a gate. Two stars sharing a pixel must register
// as one hiding the other; a lone star has nothing to hide behind.

const welded = survey([
  { id: "a-one", size: 0.2, position: [0, 0, 0] },
  { id: "a-two", size: 0.2, position: [0.004, 0, 0] },
]);
if (!welded.hidden.size) {
  console.error("Tap check aborted: two stars on one pixel register no occlusion.");
  process.exit(1);
}
if (survey([{ id: "only", size: 0.2, position: [0, 0, 0] }]).hidden.size) {
  console.error("Tap check aborted: a single star reports being hidden by itself.");
  process.exit(1);
}

/* ------------------------------------------------------------------ verdict */

const sky = layout(problems);
const result = survey(sky);
const failures = [];

if (result.positions === 0) {
  failures.push(`no star of the hero sky lands inside a ${W}x${H} viewport`);
}
const unseen = sky.length - result.sightings.size;
if (unseen > 0) {
  failures.push(`${unseen} of ${sky.length} stars never appear on screen at ${W}x${H}`);
}
if (result.smallest.r < MIN_PICK_PX) {
  failures.push(
    `${result.smallest.id} offers a pick target of ${result.smallest.r.toFixed(1)}px ` +
      `in radius, under the ${MIN_PICK_PX}px a thumb needs`,
  );
}
if (result.buried) {
  failures.push(
    `${result.buried[0]} sits behind a nearer star's pick target at every one of the ` +
      `${result.buried[1]} angles it can be seen from, so no tap can reach it`,
  );
}

if (failures.length) {
  console.error("\nTap target check failed:\n");
  for (const line of failures) console.error(`  - ${line}`);
  console.error("\nA star a thumb cannot land on is a star nobody can open.\n");
  process.exit(1);
}

const tapSummary =
  `Tap check passed: ${result.sightings.size} stars tappable at ${W}x${H}, smallest pick ` +
  `target ${result.smallest.r.toFixed(0)}px in radius, closest pair ` +
  `${result.closest.gap.toFixed(0)}px apart, over ${result.positions} star positions.`;

console.log(tapSummary);
recordGate("check-tap-targets", tapSummary);
