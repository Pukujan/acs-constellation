import type { ReactNode } from "react";

/** Renders the one short bold anchor a section is allowed, marked with ** in copy. */
export default function RichText({ text }: { text: string }): ReactNode {
  const parts = text.split("**");
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} className="font-semibold text-[hsl(var(--gold-soft))]">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}
