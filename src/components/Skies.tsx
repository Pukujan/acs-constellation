import { useMemo } from "react";

import Constellation, {
  anchorSceneId,
  type SceneLink,
  type SceneNode,
} from "./Constellation";
import {
  LAYER_HEX,
  graphEdges,
  layerByComponent,
  problems,
  problemsFor,
  t,
} from "@/lib/content";
import { anchorPosition, buildProblemSky, buildStackSky } from "@/lib/sky";

export interface SkyProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  resetSignal?: number;
  /** Full-bleed hero: the hotloader sits at the centre and the graph orbits it. */
  hotloader?: boolean;
  homeDistance?: number;
  /** How high the camera starts above the orbital plane. */
  homeElevation?: number;
  parallax?: boolean;
  /** A layer id to light up while the rest of the sky dims. */
  focus?: string | null;
  /** Play the opening approach move once. Only the hero asks for it. */
  intro?: boolean;
}

export function ProblemSky({
  selectedId,
  onSelect,
  resetSignal = 0,
  hotloader = false,
  homeDistance,
  homeElevation,
  parallax = false,
  focus = null,
  intro = false,
}: SkyProps) {
  const { nodes, links } = useMemo(() => {
    const sky = buildProblemSky(hotloader);

    const anchors: SceneNode[] = problems.length
      ? Object.keys(LAYER_HEX).map((component) => ({
          id: anchorSceneId(component),
          kind: "anchor" as const,
          position: anchorPosition(component, hotloader),
          color: LAYER_HEX[component],
          size: 0.5,
          label: layerByComponent.get(component),
          cluster: component,
        }))
      : [];

    const problemNodes: SceneNode[] = sky.map((n) => ({
      id: n.id,
      kind: "node" as const,
      position: n.position,
      color: LAYER_HEX[n.cluster],
      size: 0.15 + n.problem.evidence.length * 0.028,
      cluster: n.cluster,
    }));

    const built: SceneLink[] = [];
    sky.forEach((n) => {
      n.problem.answeredBy.forEach((component, index) => {
        built.push({
          fromId: n.id,
          toId: anchorSceneId(component),
          color: LAYER_HEX[component],
          weight: index === 0 ? 0.46 : 0.14,
        });
      });
    });

    graphEdges.forEach((edge) => {
      built.push({
        fromId: anchorSceneId(edge.from),
        toId: anchorSceneId(edge.to),
        color: LAYER_HEX[edge.from],
        weight: 0.22,
      });
    });

    return { nodes: [...anchors, ...problemNodes], links: built };
  }, [hotloader]);

  return (
    <Constellation
      nodes={nodes}
      links={links}
      selectedId={selectedId}
      onSelect={onSelect}
      resetSignal={resetSignal}
      focus={focus}
      hotloader={hotloader}
      hotloaderLabel={hotloader ? t("hotloader.name") : undefined}
      hotloaderNote={hotloader ? t("hotloader.loads") : undefined}
      sinkOnNarrow={hotloader}
      parallax={parallax}
      intro={intro}
      homeElevation={homeElevation}
      homeDistance={homeDistance ?? (hotloader ? 20 : 24)}
      ariaLabel={t("constellation.ariaLabel")}
      fallbackText={t("constellation.hierarchy")}
    />
  );
}

export function StackSky({
  selectedId,
  onSelect,
  resetSignal = 0,
  hotloader = false,
  homeDistance,
  homeElevation,
  parallax = false,
  focus = null,
  intro = false,
}: SkyProps) {
  const { nodes, links } = useMemo(() => {
    const sky = buildStackSky(hotloader);

    const componentNodes: SceneNode[] = sky.map((n) => ({
      id: n.id,
      kind: "node" as const,
      position: n.position,
      color: LAYER_HEX[n.id],
      size: 0.3 + problemsFor(n.id).length * 0.02,
      label: n.layer,
      labelAlways: true,
      cluster: n.id,
    }));

    const built: SceneLink[] = graphEdges.map((edge) => ({
      fromId: edge.from,
      toId: edge.to,
      color: LAYER_HEX[edge.from],
      weight: 0.4,
    }));

    return { nodes: componentNodes, links: built };
  }, [hotloader]);

  return (
    <Constellation
      nodes={nodes}
      links={links}
      selectedId={selectedId}
      onSelect={onSelect}
      resetSignal={resetSignal}
      focus={focus}
      hotloader={hotloader}
      hotloaderLabel={hotloader ? t("hotloader.name") : undefined}
      hotloaderNote={hotloader ? t("hotloader.loads") : undefined}
      parallax={parallax}
      intro={intro}
      homeDistance={homeDistance ?? (hotloader ? 18 : 19)}
      homeElevation={homeElevation ?? (hotloader ? 0.62 : 0.12)}
      ariaLabel={t("constellation.stackAriaLabel")}
      fallbackText={t("constellation.hierarchy")}
    />
  );
}
