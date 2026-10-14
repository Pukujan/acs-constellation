const TONE: Record<string, string> = {
  MEASURED: "text-[hsl(var(--layer-train))]",
  DERIVED: "text-[hsl(var(--layer-acs))]",
  HYPOTHESIS: "text-[hsl(var(--layer-cgm))]",
  VENDOR: "text-[hsl(var(--muted-foreground))]",
};

/**
 * The tag is a label, not a riddle: the sentence beside it already says whether
 * the figure was measured or inferred, so there is nothing to reveal on hover
 * and no tooltip to install.
 */
export default function EpistemicTag({ tag }: { tag: string }) {
  return (
    <span className={`tag ${TONE[tag] ?? "text-[hsl(var(--muted-foreground))]"}`}>
      {tag}
    </span>
  );
}
