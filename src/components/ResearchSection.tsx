import BarRowChart, { chartRows } from "@/components/BarRowChart";
import EpistemicTag from "@/components/EpistemicTag";
import StatFigure from "@/components/StatFigure";
import RichText from "@/components/RichText";
import {
  arxivUrl,
  componentById,
  layerByComponent,
  layerHex,
  research,
  t,
  type ResearchChart,
  type ResearchComponent,
} from "@/lib/content";

const ORDER = ["pcm", "oio", "acs", "cgm", "train"];

const hex = (id: string) => layerHex(id);

function slot(key: string) {
  return t(key as never);
}

function SourceLine({
  tag,
  source,
  arxiv,
}: {
  tag: string;
  source: string;
  arxiv?: string;
}) {
  const href = arxiv ? arxivUrl(arxiv) : null;
  return (
    <p className="mt-3 flex flex-wrap items-center gap-2">
      <EpistemicTag tag={tag} />
      <span className="cite">
        {t("research.sourceLabel")}{" "}
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="link-quiet">
            {source}
            <span aria-hidden="true"> &#8599;</span>
          </a>
        ) : (
          source
        )}
      </span>
    </p>
  );
}

function ChartBlock({ id, chart }: { id: string; chart: ResearchChart }) {
  return (
    <figure className="plate p-4 sm:p-5">
      <figcaption>
        <h4 className="font-display text-lg leading-snug text-[hsl(var(--foreground))]">
          {slot(`research.${id}.chartTitle`)}
        </h4>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          {slot(`research.${id}.chartSubtitle`)}
        </p>
      </figcaption>

      <div className="mt-4">
        <div role="img" aria-label={slot(`research.${id}.chartAlt`)}>
          <BarRowChart
            componentId={id}
            rows={chartRows(chart)}
            unit={chart.unit}
            referenceLine={chart.referenceLine}
            max={chart.unit.startsWith("%") ? 100 : undefined}
          />
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
        {slot(`research.${id}.chartCaption`)}
      </p>
      {typeof chart.referenceLine === "number" && (
        <p className="cite mt-2 flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-0 w-6 border-t border-dashed border-[hsl(var(--gold))]" />
          {t("research.pcm.chartNote")}
        </p>
      )}
      {chart.noStatus && (
        <div className="mt-3 rounded-lg border border-dashed border-[hsl(var(--border))] p-3">
          <p className="eyebrow">{t("research.noStatusHeading")}</p>
          <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
            {chart.noStatus.join(", ")}
          </p>
        </div>
      )}
      {chart.limit && (
        <p className="mt-2 border-l-2 border-[hsl(var(--gold)/0.4)] pl-3 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
          {chart.limit}
        </p>
      )}
      <SourceLine tag={chart.tag} source={chart.source} arxiv={chart.arxiv} />
    </figure>
  );
}

function Regimes({ block }: { block: ResearchComponent }) {
  return (
    <div className="plate p-4 sm:p-5">
      <h4 className="font-display text-lg text-[hsl(var(--foreground))]">
        {t("research.acs.regimeHeading")}
      </h4>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
        {t("research.acs.regimeNote")}
      </p>
      <ol className="mt-4 grid gap-3">
        {(block.regimes ?? []).map((regime) => (
          <li key={regime.name} className="rounded-lg bg-[hsl(var(--muted)/0.4)] p-3">
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
              {regime.name}
              <span className="ml-2 font-normal text-[hsl(var(--muted-foreground))]">
                {regime.detail}
              </span>
            </p>
            <ul className="mt-1.5 grid gap-1">
              {regime.systems.map((s) => (
                <li key={s} className="cite">
                  {s}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <SourceLine tag={block.regimeTag ?? "MEASURED"} source={block.regimeSource ?? ""} />
    </div>
  );
}

function GapTable({ block }: { block: ResearchComponent }) {
  const table = block.gapTable;
  if (!table) return null;

  return (
    <div className="plate overflow-hidden p-4 sm:p-5">
      <h4 className="font-display text-lg text-[hsl(var(--foreground))]">
        {t("research.train.tableHeading")}
      </h4>
      <p className="mt-1 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
        {t("research.train.tableNote")}
      </p>
      <div className="mt-4 grid gap-3">
        {table.rows.map((row) => (
          <div
            key={row.requirement}
            className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.35)] p-3"
          >
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
              {row.requirement}
            </p>
            <p className="cite mt-1.5">
              {t("research.priorArtLabel")} {row.priorArt}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-[hsl(var(--gold-soft))]">
              {row.gap}
            </p>
          </div>
        ))}
      </div>
      <SourceLine tag={table.tag} source={table.source} />
    </div>
  );
}

function figureLabel(id: string, key: string): string {
  const map: Record<string, string> = {
    writeOmissions: t("research.pcm.statWriteLabel"),
    extractionLoss: t("research.pcm.statExtractLabel"),
    denominator: t("research.oio.denominatorLabel"),
    visibility: t("research.acs.statVisibilityLabel"),
    pinFiles: t("research.train.statFilesLabel"),
    pinRevisions: t("research.train.statRevisionsLabel"),
  };
  return map[key] ?? slot(`research.${id}.heading`);
}

export default function ResearchSection() {
  return (
    <section id="research" aria-labelledby="research-heading" className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
      <div className="rule mb-10" />
      <p className="eyebrow">{t("research.heading")}</p>
      <h2 className="mt-3 max-w-3xl font-display text-3xl leading-tight text-[hsl(var(--foreground))] sm:text-4xl">
        {t("research.heading")}
      </h2>
      <p className="mt-4 max-w-2xl lede">{t("research.intro")}</p>

      <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 py-3">
        <p className="cite">
          <span className="font-display text-base text-[hsl(var(--gold))]">
            {research.survey.systems}
          </span>{" "}
          {t("research.surveySystems")}
        </p>
        <p className="cite">
          <span className="font-display text-base text-[hsl(var(--gold))]">
            {research.survey.clusters}
          </span>{" "}
          {t("research.surveyClusters")}
        </p>
        <p className="cite">
          <span className="font-display text-base text-[hsl(var(--gold))]">
            ~{research.survey.citedSources}
          </span>{" "}
          {t("research.surveySources")}
        </p>
        <EpistemicTag tag={research.survey.tag} />
        <p className="cite w-full">
          {t("research.surveyStatus")} {research.survey.status}
        </p>
      </div>

      <div className="mt-14 grid gap-16">
        {ORDER.map((id) => {
          const block = research.components.find((c) => c.id === id);
          if (!block) return null;
          const component = componentById.get(id);
          return (
            <article
              key={id}
              id={`research-${id}`}
              className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
            >
              <header className="lg:sticky lg:top-24 lg:self-start">
                <p className="eyebrow" style={{ color: hex(id) }}>
                  {component?.name} · {layerByComponent.get(id)}
                </p>
                <h3 className="mt-3 font-display text-2xl leading-snug text-[hsl(var(--foreground))] sm:text-[1.75rem]">
                  {slot(`research.${id}.heading`)}
                </h3>
                <p className="mt-4 max-w-prose text-[0.975rem] leading-relaxed text-[hsl(var(--muted-foreground))]">
                  <RichText text={slot(`research.${id}.body`)} />
                </p>

                {(block.figures ?? []).map((figure) => (
                  <div key={figure.key} className="mt-5 grid gap-4 sm:grid-cols-2">
                    {typeof figure.value === "number" && (
                      <StatFigure
                        figure={figure}
                        label={figureLabel(id, figure.key)}
                        accent={hex(id)}
                      />
                    )}
                    {figure.rows && (
                      <div className={`plate p-4 ${typeof figure.value !== "number" ? "sm:col-span-2" : ""}`}>
                        <p className="text-sm leading-snug text-[hsl(var(--foreground)/0.9)]">
                          {figureLabel(id, figure.key)}
                        </p>
                        <ul className="mt-2 grid gap-1">
                          {figure.rows.map((row) => (
                            <li key={row.label} className="cite flex justify-between gap-3">
                              <span>{row.label}</span>
                              <span className="text-[hsl(var(--gold-soft))]">
                                {row.value} {figure.unit}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                          {t("research.pcm.statExtractBody")}
                        </p>
                        <SourceLine
                          tag={figure.tag}
                          source={figure.source}
                          arxiv={figure.arxiv}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </header>

              <div className="grid gap-6">
                {block.chart && <ChartBlock id={id} chart={block.chart} />}
                {block.regimes && <Regimes block={block} />}
                {block.gapTable && <GapTable block={block} />}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
