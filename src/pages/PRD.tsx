import { useEffect } from "react";
import { Link } from "react-router-dom";

import BigNumber from "@/components/BigNumber";
import Citation from "@/components/Citation";
import EpistemicTag from "@/components/EpistemicTag";
import Layout from "@/components/Layout";
import RichText from "@/components/RichText";
import {
  ACS_REPOSITORY_URL,
  LAYER_VAR,
  componentById,
  evidenceTable,
  graphEdges,
  layers,
  problems,
  problemsFor,
  research,
  t,
  type CopyKey,
} from "@/lib/content";

/** The detail behind the five steps, collapsed so the page stays a two-minute read. */
const DETAILS = [
  "howto",
  "edges",
  "problems",
  "mechanism",
  "decisions",
  "parked",
  "limits",
];

export default function PRD() {
  useEffect(() => {
    document.title = `${t("prd.title")} — ${t("nav.brand")}`;
  }, []);

  const revisions = new Map<string, string>();
  problems.forEach((p) =>
    p.evidence.forEach((e) => {
      if (e.source.startsWith("repo:")) revisions.set(e.source, e.revision);
    }),
  );

  const figures = research.components
    .map((c) => ({
      id: c.id,
      figure: c.figures?.find(
        (f) =>
          f.key === "writeOmissions" ||
          f.key === "visibility" ||
          f.key === "pinFiles",
      ),
    }))
    .filter((row): row is { id: string; figure: NonNullable<typeof row.figure> } =>
      Boolean(row.figure),
    );

  return (
    <Layout>
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <header>
          <p className="eyebrow">{t("nav.prd")}</p>
          <h1 className="mt-4 font-display text-[2rem] leading-[1.08] text-[hsl(var(--foreground))] sm:text-5xl">
            {t("prd.title")}
          </h1>
          <p className="mt-6 text-[1.0625rem] leading-relaxed text-[hsl(var(--muted-foreground))]">
            <RichText text={t("prd.lede")} />
          </p>
        </header>

        <section
          id="what"
          aria-labelledby="what-heading"
          className="mt-14 border-t border-[hsl(var(--border))] pt-10"
        >
          <h2
            id="what-heading"
            className="font-display text-2xl leading-snug text-[hsl(var(--foreground))] sm:text-3xl"
          >
            {t("prd.what.heading")}
          </h2>
          <p className="mt-4 text-[1.0125rem] leading-relaxed text-[hsl(var(--muted-foreground))]">
            <RichText text={t("prd.what.body")} />
          </p>
        </section>

        <section
          id="today"
          aria-labelledby="today-heading"
          className="mt-14 border-t border-[hsl(var(--border))] pt-10"
        >
          <h2
            id="today-heading"
            className="font-display text-2xl leading-snug text-[hsl(var(--foreground))] sm:text-3xl"
          >
            {t("prd.today.heading")}
          </h2>
          <p className="mt-4 text-[1.0125rem] leading-relaxed text-[hsl(var(--muted-foreground))]">
            <RichText text={t("prd.today.body")} />
          </p>
        </section>

        {/* The centre of the page: one owner per layer, and what each one answers. */}
        <section
          id="layers"
          aria-labelledby="layers-heading"
          className="mt-14 border-t border-[hsl(var(--border))] pt-10"
        >
          <h2
            id="layers-heading"
            className="font-display text-2xl leading-snug text-[hsl(var(--foreground))] sm:text-3xl"
          >
            {t("prd.layers.heading")}
          </h2>
          <p className="mt-4 text-[1.0125rem] leading-relaxed text-[hsl(var(--muted-foreground))]">
            <RichText text={t("prd.layers.body")} />
          </p>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
              <caption className="sr-only">{t("prd.layers.heading")}</caption>
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  {["layer", "owner", "owns", "answers"].map((key) => (
                    <th
                      key={key}
                      scope="col"
                      className="py-2 pr-3 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))] last:pr-0"
                    >
                      {t(`prd.col.${key}` as CopyKey)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {layers.map((l) => {
                  const c = componentById.get(l.component);
                  return (
                    <tr
                      key={l.component}
                      className="border-b border-[hsl(var(--border)/0.6)]"
                    >
                      <th scope="row" className="py-3 pr-3 font-normal">
                        <span style={{ color: LAYER_VAR[l.component] }}>
                          {l.layer}
                        </span>
                      </th>
                      <td className="py-3 pr-3 font-mono text-xs text-[hsl(var(--foreground))]">
                        {c?.name}
                      </td>
                      <td className="py-3 pr-3 text-[hsl(var(--muted-foreground))]">
                        {c?.owns}
                      </td>
                      <td className="py-3 text-[hsl(var(--muted-foreground))]">
                        {problemsFor(l.component).length}{" "}
                        {t("map.panel.clusterCount")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section
          id="research"
          aria-labelledby="research-heading"
          className="mt-14 border-t border-[hsl(var(--border))] pt-10"
        >
          <h2
            id="research-heading"
            className="font-display text-2xl leading-snug text-[hsl(var(--foreground))] sm:text-3xl"
          >
            {t("prd.research.heading")}
          </h2>
          <p className="mt-4 text-[1.0125rem] leading-relaxed text-[hsl(var(--muted-foreground))]">
            <RichText text={t("prd.research.body")} />
          </p>

          <div className="mt-8 grid gap-8">
            {figures.map(({ id, figure }) => (
              <div key={figure.key} className="grid gap-3">
                <BigNumber
                  figure={figure}
                  label={
                    id === "pcm"
                      ? t("research.pcm.statWriteLabel")
                      : id === "acs"
                        ? t("research.acs.statVisibilityLabel")
                        : t("research.train.statFilesLabel")
                  }
                />
                <p className="-mt-1 text-[0.975rem] leading-relaxed text-[hsl(var(--foreground)/0.85)]">
                  <RichText
                    text={t(`prd.soWhat.${id === "pcm" ? "write" : id === "acs" ? "staleness" : "pin"}` as CopyKey)}
                  />
                </p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="next"
          aria-labelledby="next-heading"
          className="mt-14 border-t border-[hsl(var(--border))] pt-10"
        >
          <h2
            id="next-heading"
            className="font-display text-2xl leading-snug text-[hsl(var(--foreground))] sm:text-3xl"
          >
            {t("prd.next.heading")}
          </h2>
          <p className="mt-4 text-[1.0125rem] leading-relaxed text-[hsl(var(--muted-foreground))]">
            <RichText text={t("prd.next.body")} />
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-3">
            <Link to="/map" className="btn-hot">
              {t("block.next.map")}
            </Link>
            <a
              href={ACS_REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
              className="link-quiet text-sm"
            >
              {t("block.next.repo")}
            </a>
          </div>
        </section>

        {/* Everything a sceptic wants, one click away and out of the two-minute read. */}
        <section
          aria-labelledby="details-heading"
          className="mt-16 border-t border-[hsl(var(--border))] pt-10"
        >
          <h2
            id="details-heading"
            className="font-display text-xl leading-snug text-[hsl(var(--foreground))] sm:text-2xl"
          >
            {t("prd.details.heading")}
          </h2>
          <p className="mt-3 text-[0.975rem] leading-relaxed text-[hsl(var(--muted-foreground))]">
            {t("prd.details.body")}
          </p>

          <div className="mt-6 grid gap-3">
            {DETAILS.map((id) => (
              <details
                key={id}
                className="group rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.25)] px-4 py-3"
              >
                <summary className="cursor-pointer list-none text-[0.975rem] font-medium text-[hsl(var(--foreground))]">
                  {t(`prd.${id}.heading` as CopyKey)}
                  <span
                    aria-hidden="true"
                    className="ml-2 text-[hsl(var(--gold))]"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[0.975rem] leading-relaxed text-[hsl(var(--muted-foreground))]">
                  <RichText text={t(`prd.${id}.body` as CopyKey)} />
                </p>

                {id === "howto" && (
                  <div className="mt-5">
                    <p className="eyebrow">{t("prd.revisions.heading")}</p>
                    <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                      {t("prd.revisions.note")}
                    </p>
                    <ul className="mt-4 grid gap-2">
                      {[...revisions.entries()].map(([source, revision]) => (
                        <li
                          key={source}
                          className="cite flex flex-wrap justify-between gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-3 py-2"
                        >
                          <span>{source.replace("repo:", "")}</span>
                          <span className="break-all text-[hsl(var(--gold-soft))]">
                            {revision}
                          </span>
                        </li>
                      ))}
                      <li className="cite rounded-lg border border-dashed border-[hsl(var(--border))] px-3 py-2">
                        {evidenceTable.note}
                      </li>
                    </ul>
                  </div>
                )}

                {id === "edges" && (
                  <ul className="mt-5 grid gap-3">
                    {graphEdges.map((edge, i) => {
                      const from = componentById.get(edge.from);
                      const to = componentById.get(edge.to);
                      return (
                        <li
                          key={`${edge.from}-${edge.to}-${edge.kind}-${i}`}
                          className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-4"
                        >
                          <p className="font-mono text-xs uppercase tracking-[0.16em] text-[hsl(var(--gold))]">
                            {from?.name} &#8594; {to?.name}
                          </p>
                          <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">
                            {edge.kind}
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--foreground)/0.85)]">
                            {edge.note}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {id === "problems" && (
                  <ol className="mt-5 grid gap-8">
                    {problems.map((p, index) => (
                      <li
                        key={p.id}
                        className="border-l-2 border-[hsl(var(--border))] pl-4"
                      >
                        <p className="cite">
                          {String(index + 1).padStart(2, "0")} &#183;{" "}
                          {p.audience === "human"
                            ? t("map.panel.audienceHuman")
                            : t("map.panel.audienceAi")}
                        </p>
                        <h3 className="mt-2 font-display text-lg leading-snug text-[hsl(var(--foreground))]">
                          {p.problem}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                          {t("map.panel.consequence")} {p.humanConsequence}
                        </p>
                        <p className="mt-3 flex flex-wrap gap-2">
                          {p.answeredBy.map((componentId) => (
                            <span
                              key={componentId}
                              className="tag rounded-full"
                              style={{ color: LAYER_VAR[componentId] }}
                            >
                              {componentById.get(componentId)?.name}
                            </span>
                          ))}
                        </p>
                        <ul className="mt-3 grid gap-2">
                          {p.evidence.map((e, i) => (
                            <li key={`${e.source}-${e.line}-${i}`}>
                              <Citation evidence={e} />
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                )}

                {id === "limits" && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {["MEASURED", "DERIVED", "HYPOTHESIS", "VENDOR"].map((tag) => (
                      <EpistemicTag key={tag} tag={tag} />
                    ))}
                  </div>
                )}
              </details>
            ))}
          </div>
        </section>

        {/* A Biscay star strip, not a photo plate: the ramp allows no other hue. */}
        <div
          aria-hidden="true"
          className="relative mt-16 h-32 w-full overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--biscay-deep))]"
        >
          <div className="parallax-band" />
        </div>
      </div>
    </Layout>
  );
}
