import EpistemicTag from "@/components/EpistemicTag";
import { arxivUrl, t, type ResearchFigure } from "@/lib/content";

/**
 * One number, one line beside it, one citation under it. The figure is the
 * argument; there is no paragraph wrapping it.
 */
export default function BigNumber({
  figure,
  label,
}: {
  figure: ResearchFigure;
  label: string;
}) {
  const href = figure.arxiv ? arxivUrl(figure.arxiv) : null;

  return (
    <div className="grid content-start gap-2 border-t border-[hsl(var(--biscay-line))] pt-5">
      <p className="big-number">
        {figure.value}
        <span className="ml-1 font-mono text-sm uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">
          {figure.unit}
        </span>
      </p>
      <p className="text-[0.9375rem] leading-snug text-[hsl(var(--whisper))]">{label}</p>
      <p className="flex flex-wrap items-center gap-2">
        <EpistemicTag tag={figure.tag} />
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="cite link-quiet">
            {figure.source}
            <span aria-hidden="true"> &#8599;</span>
          </a>
        ) : (
          <span className="cite">{figure.source}</span>
        )}
      </p>
      {figure.measuredOn && (
        <p className="cite">
          {t("research.measuredOn")} {figure.measuredOn}
        </p>
      )}
    </div>
  );
}
