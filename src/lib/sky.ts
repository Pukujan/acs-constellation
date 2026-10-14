/**
 * sky.ts — where every point in the sky sits.
 *
 * The layout is deterministic, never random: each problem keeps its place across
 * reloads, routes and devices, so two people can point at "the bright one above
 * the hotloader" and mean the same star.
 *
 * `tools/check-tap-targets.mjs` mirrors the maths below and reads every constant
 * out of this file, so changing a number here changes what the gate measures.
 */
import {
  layers,
  primaryLayer,
  problems,
  type Problem,
} from "@/lib/content";

/** A world position, straight into `THREE.Vector3`. */
export type Vec3 = [number, number, number];

/**
 * The five answering layers sit on a ring of this radius, in the order
 * `content/graph.json` lists them.
 */
const ORBIT_RADIUS = 6.2;

/**
 * Vertical step per layer band. The stack is read top to bottom, so the rings sit
 * at different heights instead of at different depths.
 */
const LAYER_LIFT = [1.6, -2.2, 0.8, -1.4, 2.4];

/** The anchor a problem is clustered under. Anchors are rings, never pickable. */
export function anchorSceneId(component: string): string {
  return `anchor:${component}`;
}

/**
 * FNV-1a over the problem id, in [0,1). Stable across runs and platforms, so the
 * scatter below is the same sky for everyone. Anything that needs a per-star
 * value (the layout here, the twinkle in the scene) takes it from this one
 * function, so the same id always gets the same number.
 */
export function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/**
 * The centre of one layer's cluster.
 *
 * The ring lies across the sky, not up it: x and z carry the orbit, and the layer
 * band is a vertical step. A ring drawn in the vertical plane puts the lowest
 * cluster under the copy column on a phone, where no amount of turning brings it
 * back into frame.
 *
 * `orbiting` is the hero, where the graph turns around the hotloader and the ring
 * is squashed in depth so the turn reads as parallax. The map holds still and
 * opens wider.
 */
export function anchorPosition(component: string, orbiting: boolean): Vec3 {
  const index = Math.max(
    0,
    layers.findIndex((l) => l.component === component),
  );
  const angle = (index / layers.length) * Math.PI * 2 - Math.PI / 2;
  const squash = orbiting ? 0.62 : 0.9;
  return [
    Math.cos(angle) * ORBIT_RADIUS,
    LAYER_LIFT[index % LAYER_LIFT.length] * 0.55,
    Math.sin(angle) * ORBIT_RADIUS * squash,
  ];
}

export interface PlacedProblem {
  id: string;
  /** The primary answering layer: the first entry in `answeredBy`. */
  cluster: string;
  problem: Problem;
  position: Vec3;
}

/**
 * Problems cluster around their answering layer, fanned out with the golden angle
 * so no two members of a cluster line up with each other, and pushed apart in z
 * by a per-id jitter so nothing stacks exactly on the camera axis.
 */
export function buildProblemSky(orbiting: boolean): PlacedProblem[] {
  const grouped = new Map<string, Problem[]>();
  for (const problem of problems) {
    const key = primaryLayer(problem);
    grouped.set(key, [...(grouped.get(key) ?? []), problem]);
  }

  const out: PlacedProblem[] = [];
  for (const [cluster, group] of grouped) {
    // ax carries the ring, ay the layer band, az the depth of the ring.
    const [ax, ay, az] = anchorPosition(cluster, orbiting);
    const spread = (orbiting ? 1.55 : 1.9) + group.length * 0.4;

    group.forEach((problem, i) => {
      const golden = i * 2.399963;
      const jitter = hash(problem.id);
      const lift = group.length === 1 ? 0 : (i / (group.length - 1) - 0.5) * 2;
      const radius = spread * (0.62 + jitter * 0.5);
      out.push({
        id: problem.id,
        cluster,
        problem,
        position: [
          ax + Math.cos(golden) * radius,
          ay + lift * (2.1 + jitter * 1.4),
          az + Math.sin(golden) * radius * 0.82 - jitter * 1.6,
        ],
      });
    });
  }
  return out;
}

export interface PlacedComponent {
  id: string;
  /** The layer name from `content/graph.json`, used as the node's label. */
  layer: string;
  position: Vec3;
}

/**
 * The stack constellation: one node per component, placed by its layer band. The
 * order is the layer table's order, top band first, so the sky reads as the stack.
 */
export function buildStackSky(orbiting: boolean): PlacedComponent[] {
  const count = layers.length;
  return layers.map((entry, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const radius = orbiting ? 5.4 : 6.1;
    const band = (count > 1 ? i / (count - 1) : 0.5) - 0.5;
    return {
      id: entry.component,
      layer: entry.layer,
      position: [
        Math.cos(angle) * radius,
        band * (orbiting ? 4.6 : 5.4),
        Math.sin(angle) * radius * 0.5,
      ],
    };
  });
}
