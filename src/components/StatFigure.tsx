import EpistemicTag from "@/components/EpistemicTag";
import { arxivUrl, t, type ResearchFigure } from "@/lib/content";

export default function StatFigure({
  figure,
  label,
  accent,
}: {
  figure: ResearchFigure;
  label: string;
  accent: string;
}) {
  const href = figure.arxiv ? arxivUrl(figure.arxiv) : null;

  return (
    <div className="plate p-4">
      <p className="flex items-baseline gap-2">
        <span
          className="font-display text-4xl leading-none tabular-nums"
          style={{ color: accent }}
        >
          {figure.value}
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">
          {figure.unit}
        </span>
      </p>
      <p className="mt-2 text-sm leading-snug text-[hsl(var(--foreground)/0.9)]">
        {label}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <EpistemicTag tag={figure.tag} />
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="cite link-quiet"
          >
            {figure.source}
            <span aria-hidden="true"> &#8599;</span>
          </a>
        ) : (
          <span className="cite">{figure.source}</span>
        )}
      </div>
      {figure.measuredOn && (
        <p className="cite mt-1.5">{t("research.measuredOn")} {figure.measuredOn}</p>
      )}
    </div>
  );
}
