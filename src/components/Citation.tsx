import { citationText, citationUrl, t, type Evidence } from "@/lib/content";

export default function Citation({
  evidence,
  showLabel = true,
}: {
  evidence: Evidence;
  showLabel?: boolean;
}) {
  const url = citationUrl(evidence);
  const where = citationText(evidence);

  return (
    <div className="cite rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.55)] p-3">
      {showLabel && (
        <p className="mb-2 font-body text-[0.8125rem] leading-relaxed text-[hsl(var(--foreground))]">
          {evidence.label}
        </p>
      )}
      <p className="break-words">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="link-quiet inline-flex items-start gap-1.5"
          >
            <span>{where}</span>
            <span aria-hidden="true" className="pt-px">
              &#8599;
            </span>
          </a>
        ) : (
          <span>{where}</span>
        )}
      </p>
      <p className="mt-1 break-all text-[hsl(var(--muted-foreground)/0.85)]">
        {evidence.revision}
      </p>
      {url && (
        <span className="sr-only">{t("map.panel.openSource")}</span>
      )}
    </div>
  );
}
