import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import Block from "@/components/Block";
import Citation from "@/components/Citation";
import Layout from "@/components/Layout";
import RichText from "@/components/RichText";
import SkyPanel from "@/components/SkyPanel";
import {
  LAYER_VAR,
  components,
  evidenceTable,
  problems,
  t,
  type CopyKey,
} from "@/lib/content";

type Mode = "problems" | "stack" | "timeline";

const MODES: { id: Mode; key: CopyKey }[] = [
  { id: "problems", key: "map.mode.problems" },
  { id: "stack", key: "map.mode.stack" },
  { id: "timeline", key: "map.mode.timeline" },
];

const DATED = [
  {
    date: "2026-10-01",
    what: t("map.timeline.pinEvent"),
    evidence:
      problems.find((p) => p.id === "version-pin-copied-across-files")?.evidence[0] ??
      null,
  },
  {
    date: "2026-10-13",
    what: t("map.timeline.harvestEvent"),
    evidence: evidenceTable.row,
  },
];

export default function MapPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("view");
  const mode: Mode =
    raw === "stack" || raw === "timeline" || raw === "problems"
      ? raw
      : "problems";
  const setMode = (next: Mode) => setParams({ view: next }, { replace: true });

  useEffect(() => {
    document.title = `${t("map.title")} — ${t("nav.brand")}`;
  }, []);

  return (
    <Layout>
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="max-w-3xl">
        <p className="eyebrow">{t("map.eyebrow")}</p>
        <h1 className="mt-4 font-display text-[2rem] leading-[1.08] text-[hsl(var(--foreground))] sm:text-5xl">
          {t("map.title")}
        </h1>
        <p className="mt-5 text-[1.0625rem] leading-relaxed text-[hsl(var(--muted-foreground))]">
          <RichText text={t("map.lede")} />
        </p>
      </header>

      <div
        role="tablist"
        aria-label={t("map.title")}
        className="mt-8 flex flex-wrap gap-2"
      >
        {MODES.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`rounded-full border px-4 py-2 font-mono text-[0.6875rem] uppercase tracking-[0.16em] transition-colors ${
              mode === m.id
                ? "border-[hsl(var(--gold)/0.7)] bg-[hsl(var(--gold)/0.14)] text-[hsl(var(--gold))]"
                : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {t(m.key)}
          </button>
        ))}
      </div>

      <p className="mt-6 max-w-prose text-sm italic text-[hsl(var(--muted-foreground))]">
        {mode === "problems"
          ? t("map.caption.problems")
          : mode === "stack"
            ? t("map.caption.stack")
            : t("map.caption.timeline")}
      </p>

      <div className="mt-6" role="tabpanel">
        {mode !== "timeline" && <SkyPanel variant={mode} overSky />}

        {mode === "timeline" && (
          <div className="grid gap-8">
            <ol className="relative grid gap-6 border-l border-[hsl(var(--gold)/0.35)] pl-6">
              {DATED.map((event) => (
                <li key={event.date} className="relative">
                  <span
                    aria-hidden="true"
                    className="timeline-dot absolute -left-[31px] top-2 h-2.5 w-2.5 rounded-full"
                  />
                  <p className="font-mono text-sm text-[hsl(var(--gold-soft))]">
                    {event.date}
                  </p>
                  <p className="mt-1.5 max-w-prose text-[0.975rem] leading-relaxed text-[hsl(var(--foreground)/0.9)]">
                    {event.what}
                  </p>
                  {event.evidence && (
                    <div className="mt-3 max-w-lg">
                      <Citation evidence={event.evidence} showLabel={false} />
                    </div>
                  )}
                </li>
              ))}
            </ol>

            <div>
              <h2 className="font-display text-2xl text-[hsl(var(--foreground))]">
                {t("map.timeline.ownershipHeading")}
              </h2>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                {t("map.timeline.ownershipNote")}
              </p>
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {components.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-4"
                  >
                    <p
                      className="font-mono text-xs uppercase tracking-[0.18em]"
                      style={{ color: LAYER_VAR[c.id] }}
                    >
                      {c.name}
                    </p>
                    <p className="mt-1.5 font-display text-lg text-[hsl(var(--foreground))]">
                      {c.full}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                      {c.owns}
                    </p>
                    <p className="cite mt-3">{t("map.timeline.undated")}</p>
                  </li>
                ))}
              </ul>
            </div>

            <p className="max-w-prose border-l-2 border-[hsl(var(--gold)/0.4)] pl-4 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
              {t("map.timeline.note")}
            </p>
          </div>
        )}
      </div>

      <div className="mt-16">
        <Block id="next" wide />
      </div>
    </div>
    </Layout>
  );
}
