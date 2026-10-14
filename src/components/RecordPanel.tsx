import Citation from "@/components/Citation";
import {
  componentById,
  edgesFor,
  layersNotOwned,
  problemsFor,
  primaryLayer,
  t,
  type Problem,
} from "@/lib/content";

export function ProblemRecord({ problem }: { problem: Problem }) {
  const primary = primaryLayer(problem);
  const owners = problem.answeredBy
    .map((id) => componentById.get(id)?.name)
    .filter(Boolean);

  return (
    <article className="grid gap-4">
      <div>
        <p className="eyebrow">{t("map.panel.problem")}</p>
        <h3 className="mt-2 font-display text-lg leading-snug text-[hsl(var(--foreground))]">
          {problem.problem}
        </h3>
      </div>

      <div>
        <p className="eyebrow">{t("map.panel.consequence")}</p>
        <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
          {problem.humanConsequence}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="eyebrow">{t("map.panel.answeredBy")}</p>
        <ul className="flex flex-wrap gap-2">
          {owners.map((name) => (
            <li
              key={name}
              className={`tag rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.6)] px-2.5 py-1 text-[hsl(var(--foreground))] layer-${primary}`}
            >
              {name}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="eyebrow">{t("map.panel.citation")}</p>
        <ul className="mt-2 grid gap-2">
          {problem.evidence.map((e, i) => (
            <li key={`${e.source}-${e.line}-${i}`}>
              <Citation evidence={e} />
            </li>
          ))}
        </ul>
      </div>

      <p className="cite">
        {problem.audience === "human"
          ? t("map.panel.audienceHuman")
          : t("map.panel.audienceAi")}
      </p>
    </article>
  );
}

export function ComponentRecord({ id }: { id: string }) {
  const component = componentById.get(id);
  if (!component) return null;
  const notOwned = layersNotOwned(id);
  const edges = edgesFor(id);
  const owned = problemsFor(id);

  return (
    <article className="grid gap-4">
      <div>
        <p className="eyebrow">{component.name}</p>
        <h3 className="mt-2 font-display text-lg leading-snug text-[hsl(var(--foreground))]">
          {component.full}
        </h3>
      </div>

      <div>
        <p className="eyebrow">{t("map.panel.owns")}</p>
        <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
          {component.owns}
        </p>
      </div>

      <div>
        <p className="eyebrow">{t("map.panel.notOwns")}</p>
        <ul className="mt-2 grid gap-1.5">
          {notOwned.map((layer) => (
            <li
              key={layer}
              className="text-sm text-[hsl(var(--muted-foreground)/0.85)]"
            >
              {layer}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="eyebrow">{t("map.panel.relationships")}</p>
        <ul className="mt-2 grid gap-2">
          {edges.map((edge, i) => (
            <li
              key={`${edge.from}-${edge.to}-${i}`}
              className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] p-3"
            >
              <p className="cite">
                {componentById.get(edge.from)?.name} →{" "}
                {componentById.get(edge.to)?.name}
              </p>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                {edge.note}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <p className="cite">
        {owned.length} {t("map.panel.clusterCount")}
      </p>
    </article>
  );
}
