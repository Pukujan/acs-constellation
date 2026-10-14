import {
  LAYER_VAR,
  componentById,
  layers,
  problems,
  problemsFor,
  t,
  tList,
  type CopyKey,
} from "@/lib/content";

/**
 * The four copies of one background, drawn as the drift it is instead of
 * described as a paragraph.
 */
export function DriftFigure() {
  const human = problems.filter((p) => p.audience === "human");

  return (
    <div className="plate overflow-hidden">
      <div className="border-b border-[hsl(var(--east-bay)/0.5)] px-4 py-3">
        <p className="eyebrow">{t("block.problem.heading")}</p>
      </div>
      <ol className="grid">
        {human.map((p, index) => {
          const primary = p.answeredBy[0];
          return (
            <li
              key={p.id}
              className="grid gap-2 border-b border-[hsl(var(--east-bay)/0.35)] px-4 py-4 last:border-b-0 sm:grid-cols-[auto_1fr] sm:gap-4"
            >
              <span
                aria-hidden="true"
                className="font-display text-2xl leading-none text-[hsl(var(--twine))]"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <p className="text-[0.975rem] leading-snug text-[hsl(var(--whisper))]">
                  {p.problem}
                </p>
                <p className="mt-1.5 text-sm leading-snug text-[hsl(var(--whisper)/0.68)]">
                  <span className="cite mr-2">{t("block.problem.consequenceLabel")}</span>
                  {p.humanConsequence}
                </p>
                <p
                  className="mt-2 font-mono text-[0.625rem] uppercase tracking-[0.16em]"
                  style={{ color: LAYER_VAR[primary] }}
                >
                  {componentById.get(primary)?.name} ·{" "}
                  {layers.find((l) => l.component === primary)?.layer}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** One conversation against one repository, as a before/after. */
export function BeforeAfterFigure() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {[
        {
          label: t("figure.before.label"),
          heading: t("figure.before.heading"),
          items: tList("figure.before.items"),
          hot: false,
        },
        {
          label: t("figure.after.label"),
          heading: t("figure.after.heading"),
          items: tList("figure.after.items"),
          hot: true,
        },
      ].map((column) => (
        <div
          key={column.label}
          className={`plate p-4 ${
            column.hot ? "ring-1 ring-[hsl(var(--studio)/0.6)]" : ""
          }`}
        >
          <p className="eyebrow">{column.label}</p>
          <p className="mt-2 font-display text-xl text-[hsl(var(--whisper))]">
            {column.heading}
          </p>
          <ul className="mt-3 grid gap-2">
            {column.items.map((item) => (
              <li
                key={item}
                className="flex gap-2 text-sm leading-snug text-[hsl(var(--whisper)/0.82)]"
              >
                <span
                  aria-hidden="true"
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    column.hot
                      ? "bg-[hsl(var(--studio))]"
                      : "bg-[hsl(var(--whisper)/0.35)]"
                  }`}
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="cite sm:col-span-2">{t("figure.boundary")}</p>
    </div>
  );
}

/** What the hotloader carries in, and what it deliberately does not own. */
export function HotloaderFigure() {
  return (
    <div className="plate p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span
          aria-hidden="true"
          className="relative grid h-9 w-9 place-items-center rounded-full bg-[hsl(var(--biscay-deep))] ring-1 ring-[hsl(var(--studio)/0.7)]"
        >
          <span className="absolute inset-1 rounded-full bg-[hsl(var(--studio)/0.35)] blur-[3px]" />
          <span className="relative h-2.5 w-2.5 rounded-full bg-[hsl(var(--twine))]" />
        </span>
        <div>
          <p className="font-display text-lg leading-none text-[hsl(var(--whisper))]">
            {t("hotloader.name")}
          </p>
          <p className="mt-1.5 text-sm text-[hsl(var(--whisper)/0.75)]">
            {t("hotloader.loads")}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="eyebrow">{t("map.panel.owns")}</dt>
          <dd className="mt-2 text-sm leading-snug text-[hsl(var(--whisper)/0.85)]">
            {t("hotloader.owns")}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">{t("map.panel.notOwns")}</dt>
          <dd className="mt-2 text-sm leading-snug text-[hsl(var(--whisper)/0.85)]">
            {t("hotloader.notOwns")}
          </dd>
        </div>
      </dl>

      <ul className="mt-5 flex flex-wrap gap-2">
        {layers.map((l) => {
          const c = componentById.get(l.component);
          return (
            <li
              key={l.component}
              className="tag rounded-full border border-[hsl(var(--east-bay)/0.7)] bg-[hsl(var(--biscay)/0.5)] px-2.5 py-1"
              style={{ color: LAYER_VAR[l.component] }}
            >
              {c?.name}
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-sm leading-relaxed text-[hsl(var(--whisper)/0.7)]">
        {t("hotloader.figureNote")}
      </p>
    </div>
  );
}

/** One row per repository: what it owns, how many failures sit in its cluster. */
export function StackTable() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {(["acs", "oio", "pcm", "cgm", "train"] as const).map((id) => {
        const c = componentById.get(id);
        if (!c) return null;
        const owned = problemsFor(id).length;
        return (
          <article key={id} className="plate flex flex-col gap-2 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p
                className="font-mono text-xs uppercase tracking-[0.18em]"
                style={{ color: LAYER_VAR[id] }}
              >
                {c.name}
              </p>
              <p className="cite">
                {owned} {t("map.panel.clusterCount")}
              </p>
            </div>
            <h3 className="font-display text-lg leading-snug text-[hsl(var(--whisper))]">
              {t(`block.${id}.heading` as CopyKey)}
            </h3>
            <p className="text-sm leading-relaxed text-[hsl(var(--whisper)/0.72)]">
              {t(`block.${id}.body` as CopyKey)}
            </p>
            <p className="mt-auto border-t border-[hsl(var(--east-bay)/0.4)] pt-2 text-sm text-[hsl(var(--whisper)/0.8)]">
              <span className="eyebrow mr-2">{t("map.panel.owns")}</span>
              {c.owns}
            </p>
          </article>
        );
      })}
    </div>
  );
}
