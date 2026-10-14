import problemsBundle from "@content/problems.json";
import graphBundle from "@content/graph.json";
import researchBundle from "@content/research.json";
import copy from "@content/copy.json";

export type Audience = "human" | "ai-development";

export interface Evidence {
  label: string;
  source: string;
  path: string;
  line: number;
  revision: string;
}

export interface Problem {
  id: string;
  problem: string;
  humanConsequence: string;
  audience: Audience;
  answeredBy: string[];
  evidence: Evidence[];
}

export interface Component {
  id: string;
  name: string;
  full: string;
  owns: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: string;
  note: string;
}

export const problems = problemsBundle.problems as Problem[];
export const components = problemsBundle.components as Component[];
export const layers = graphBundle.layers as { layer: string; component: string }[];
export const graphEdges = graphBundle.edges as GraphEdge[];
export const evidenceTable = graphBundle.evidenceTable as {
  note: string;
  row: Evidence;
};
export const research = researchBundle as unknown as Research;

export interface ResearchFigure {
  key: string;
  value?: number;
  unit?: string;
  tag: string;
  source: string;
  arxiv?: string;
  quote: string;
  measuredOn?: string;
  rows?: { label: string; value: number }[];
}

export interface ResearchChart {
  id: string;
  kind: string;
  tag: string;
  source: string;
  arxiv?: string;
  unit: string;
  quote: string;
  limit?: string;
  referenceLine?: number;
  rows?: { label: string; value: number; range?: string }[];
  groups?: { label: string; value: number; members: string[] }[];
  noStatus?: string[];
}

export interface ResearchComponent {
  id: string;
  figures?: ResearchFigure[];
  chart?: ResearchChart;
  regimes?: { name: string; detail: string; systems: string[] }[];
  regimeSource?: string;
  regimeTag?: string;
  gapTable?: {
    tag: string;
    source: string;
    rows: { requirement: string; priorArt: string; gap: string }[];
  };
}

export interface Research {
  survey: {
    systems: number;
    clusters: number;
    citedSources: number;
    path: string;
    tag: string;
    status: string;
  };
  components: ResearchComponent[];
}

export const componentById = new Map(components.map((c) => [c.id, c]));
export const layerByComponent = new Map(layers.map((l) => [l.component, l.layer]));
export const componentByLayer = new Map(layers.map((l) => [l.component, l]));

export function primaryLayer(p: Problem): string {
  return p.answeredBy[0];
}

/** The layers a component explicitly does not own: every other layer in the table. */
export function layersNotOwned(id: string): string[] {
  return layers.filter((l) => l.component !== id).map((l) => l.layer);
}

export function edgesFor(id: string): GraphEdge[] {
  return graphEdges.filter((e) => e.from === id || e.to === id);
}

export function problemsFor(id: string): Problem[] {
  return problems.filter((p) => primaryLayer(p) === id);
}

const REPO_HOST = "https://github.com/";
const ARXIV_HOST = "https://arxiv.org/abs/";

/**
 * Builds an openable link for a harvested citation. Only `repo:` sources have a
 * public host in this bundle; `paper:` sources link to arXiv, and the research
 * corpus is not a checkout, so it gets no link at all.
 */
export function citationUrl(e: Evidence): string | null {
  if (e.source.startsWith("repo:")) {
    const owner = e.source.slice("repo:".length);
    return `${REPO_HOST}${owner}/blob/${e.revision}/${e.path}#L${e.line}`;
  }
  if (e.source.startsWith("paper:")) {
    const id = e.source.slice("paper:".length).replace(/^arXiv:/, "");
    return `${ARXIV_HOST}${id}`;
  }
  return null;
}

/** Human-readable form of the citation, without the `repo:` and `paper:` prefixes. */
export function citationText(e: Evidence): string {
  const where = `${e.path}:${e.line}`;
  if (e.source.startsWith("repo:") || e.source.startsWith("paper:")) {
    return `${e.source.slice(e.source.indexOf(":") + 1)} — ${where}`;
  }
  return `${e.source} — ${where}`;
}

export function arxivUrl(id: string): string {
  return `${ARXIV_HOST}${id}`;
}

export function repositoryUrl(id: string): string {
  const name = REPOSITORY_NAMES[id];
  return `${REPO_HOST}${name}`;
}

export const REPOSITORY_NAMES: Record<string, string> = {
  oio: "Pukujan/observational-issue-ops",
  acs: "Pukujan/agent-custom-setup",
  pcm: "Pukujan/project-continuity-modules",
  cgm: "Pukujan/content-generation-modules",
  train: "Pukujan/agent-stack-train",
};

export const ACS_REPOSITORY_URL = repositoryUrl("acs");

/** Layer accents as CSS vars. Five steps of one ramp, never five hues. */
export const LAYER_VAR: Record<string, string> = {
  oio: "var(--layer-oio)",
  acs: "var(--layer-acs)",
  pcm: "var(--layer-pcm)",
  cgm: "var(--layer-cgm)",
  train: "var(--layer-train)",
};

/**
 * Mona, as raw hex for the WebGL side, where CSS variables do not apply.
 * Nothing outside these five values may reach a material, a light or a star.
 */
export const MONA = {
  biscay: 0x1d2b5d,
  eastBay: 0x3c3d86,
  studio: 0x7a3eb2,
  twine: 0xc8a06a,
  whisper: 0xf2f3f8,
} as const;

export const MONA_HEX: Record<keyof typeof MONA, string> = {
  biscay: "#1D2B5D",
  eastBay: "#3C3D86",
  studio: "#7A3EB2",
  twine: "#C8A06A",
  whisper: "#F2F3F8",
};

/**
 * WebGL-side values. Three.js cannot read CSS variables, so the five Mona
 * colors are repeated here and nowhere else. The `*Lift` and `*Wash` entries
 * are the same hue at a different lightness, never a new hue, and each one is
 * mirrored by a `--layer-*` token in src/globals.css.
 */
export const WEBGL = {
  biscay: 0x1d2b5d,
  eastBay: 0x3c3d86,
  eastBayLift: 0x7f80d2,
  studio: 0x7a3eb2,
  studioLift: 0xa069d3,
  studioWash: 0xcdb5e3,
  twine: 0xc8a06a,
  whisper: 0xf2f3f8,
} as const;

/**
 * Five steps of one ramp, keyed by component id. Studio is ACS because ACS is
 * the thing being sold; the rest sit around it in the same ramp.
 */
export const LAYER_HEX: Record<string, number> = {
  oio: WEBGL.twine,
  acs: WEBGL.studioLift,
  pcm: WEBGL.studioWash,
  cgm: WEBGL.eastBayLift,
  train: WEBGL.whisper,
};

/** The layer ramp as a CSS color string, for SVG, charts and inline styles. */
export function layerHex(id: string): string {
  return `#${(LAYER_HEX[id] ?? WEBGL.twine).toString(16).padStart(6, "0")}`;
}

/**
 * Slot names are validated at build time by tools/check-copy.mjs, which fails
 * the build when a requested slot is missing from content/copy.json.
 */
export type CopyKey = string;

export function t(key: CopyKey): string {
  const value = (copy as Record<string, unknown>)[key];
  if (typeof value !== "string") {
    throw new Error(`copy slot ${key} is not a string`);
  }
  return value;
}

export function tList(key: CopyKey): string[] {
  const value = (copy as Record<string, unknown>)[key];
  if (!Array.isArray(value)) {
    throw new Error(`copy slot ${key} is not a list`);
  }
  return value as string[];
}

export const copyKeys = Object.keys(copy);
