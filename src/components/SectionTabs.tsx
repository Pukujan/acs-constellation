import { useEffect, useRef, useState } from "react";

import { t, type CopyKey } from "@/lib/content";

export type SectionId = "problem" | "stack" | "research" | "demo";

const SECTIONS: { id: SectionId; key: CopyKey }[] = [
  { id: "problem", key: "tabs.problem" },
  { id: "stack", key: "tabs.stack" },
  { id: "research", key: "tabs.research" },
  { id: "demo", key: "tabs.demo" },
];

/**
 * The page is switched, not scrolled. The bar sticks under the header, which
 * is 64px tall, and the active panel is mounted while the others are not.
 */
export default function SectionTabs({
  active,
  onChange,
}: {
  active: SectionId;
  onChange: (id: SectionId) => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!panelRef.current) return;
    const header = 64;
    const top = panelRef.current.getBoundingClientRect().top;
    if (top < header) {
      window.scrollTo({ top: window.scrollY + top - header, behavior: "auto" });
    }
  }, [active]);

  return (
    <div className="sticky top-16 z-30 border-b border-[hsl(var(--biscay-line)/0.6)] bg-[hsl(var(--biscay-deep)/0.88)] backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
        <div role="tablist" aria-label={t("tabs.label")} className="section-tabs">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`tab-${s.id}`}
              aria-selected={active === s.id}
              aria-controls={`panel-${s.id}`}
              onClick={() => onChange(s.id)}
              className="section-tab"
            >
              {t(s.key)}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={panelRef}
        id={`panel-${active}`}
        role="tabpanel"
        aria-labelledby={`tab-${active}`}
        tabIndex={-1}
        className="focus:outline-none"
      />
    </div>
  );
}

export { SECTIONS };
