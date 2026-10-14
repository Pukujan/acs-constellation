import { useMemo, useState } from "react";

import { ComponentRecord, ProblemRecord } from "@/components/RecordPanel";
import RecordSurface, { EmptyRecord } from "@/components/RecordSurface";
import { ProblemSky, StackSky } from "@/components/Skies";
import { components, layers, problems, t } from "@/lib/content";

interface Props {
  variant: "problems" | "stack";
  /** "side" puts the record beside the sky; "stack" keeps the sky as the centrepiece. */
  layout?: "side" | "stack";
  skyHeight?: string;
  /** Open the record as a translucent sheet on phones, over the sky. */
  overSky?: boolean;
}

export default function SkyPanel({
  variant,
  layout = "side",
  skyHeight = "h-[380px] sm:h-[460px] lg:h-[560px]",
  overSky = false,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);

  const ids = useMemo(
    () =>
      variant === "problems"
        ? problems.map((p) => p.id)
        : components.map((c) => c.id),
    [variant],
  );

  const selectedProblem =
    variant === "problems" ? problems.find((p) => p.id === selectedId) : undefined;
  const selectedComponent =
    variant === "stack" ? components.find((c) => c.id === selectedId) : undefined;

  const body = selectedProblem ? (
    <ProblemRecord problem={selectedProblem} />
  ) : selectedComponent ? (
    <ComponentRecord id={selectedComponent.id} />
  ) : (
    <EmptyRecord />
  );

  const title = selectedProblem
    ? selectedProblem.problem
    : selectedComponent
      ? selectedComponent.full
      : t("map.panel.none");

  const sky = (
    <div className="grid gap-3">
      <div className={`canvas-shell relative ${skyHeight}`}>
        {variant === "problems" ? (
          <ProblemSky
            selectedId={selectedId}
            onSelect={setSelectedId}
            resetSignal={resetSignal}
            hotloader
          />
        ) : (
          <StackSky
            selectedId={selectedId}
            onSelect={setSelectedId}
            resetSignal={resetSignal}
            hotloader
          />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-end gap-3 p-3">
          <button
            type="button"
            onClick={() => setResetSignal((n) => n + 1)}
            className="pointer-events-auto rounded-full border border-[hsl(var(--gold)/0.4)] bg-[hsl(var(--background)/0.7)] px-3 py-1.5 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-[hsl(var(--gold-soft))] backdrop-blur hover:bg-[hsl(var(--gold)/0.14)]"
          >
            {t("map.reset")}
          </button>
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {layers.map((l) => (
          <li
            key={l.component}
            className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]"
          >
            <span
              className={`h-2 w-2 rounded-full bg-layer-${l.component}`}
              aria-hidden="true"
            />
            {l.layer}
          </li>
        ))}
      </ul>
    </div>
  );

  const record = (
    <RecordSurface
      open={Boolean(selectedId)}
      onClose={() => setSelectedId(null)}
      title={title}
      inline={body}
      overSky={overSky}
    >
      {body}
    </RecordSurface>
  );

  const list = (
    <details className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.25)] px-4 py-3">
      <summary className="eyebrow cursor-pointer list-none">
        {t("constellation.listHeading")}
        <span aria-hidden="true" className="ml-2 text-[hsl(var(--gold))]">
          +
        </span>
      </summary>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {ids.map((id) => {
          const label =
            variant === "problems"
              ? (problems.find((p) => p.id === id)?.problem ?? id)
              : (components.find((c) => c.id === id)?.full ?? id);
          return (
            <li key={id}>
              <button
                type="button"
                data-sky-select=""
                onClick={() => setSelectedId(id)}
                aria-pressed={selectedId === id}
                className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm leading-snug transition-colors ${
                  selectedId === id
                    ? "border-[hsl(var(--gold)/0.6)] bg-[hsl(var(--gold)/0.1)] text-[hsl(var(--foreground))]"
                    : "border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.35)] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--gold)/0.35)] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                <span className="sr-only">{t("constellation.selectPrefix")} </span>
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </details>
  );

  if (layout === "stack") {
    return (
      <div className="grid gap-5">
        {sky}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          {record}
          {list}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      {sky}
      {record}
      <div className="lg:col-span-2">{list}</div>
    </div>
  );
}
