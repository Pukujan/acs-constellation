import { Link } from "react-router-dom";

import Citation from "@/components/Citation";
import { ACS_REPOSITORY_URL, evidenceTable, t } from "@/lib/content";

export default function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-[hsl(var(--border))] bg-[hsl(var(--biscay-panel)/0.6)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr]">
        <div>
          <p className="font-display text-xl text-[hsl(var(--foreground))]">
            {t("footer.tagline")}
          </p>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
            {t("footer.provenance")}
          </p>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-[hsl(var(--muted-foreground)/0.85)]">
            {t("footer.limit")}
          </p>
        </div>

        <div className="grid content-start gap-4">
          <nav aria-label={t("nav.brandExpanded")} className="grid gap-2">
            <Link to="/map" className="link-quiet text-sm">
              {t("footer.map")}
            </Link>
            <Link to="/prd" className="link-quiet text-sm">
              {t("footer.prd")}
            </Link>
            <a
              href={ACS_REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
              className="link-quiet text-sm"
            >
              {t("footer.repo")}
            </a>
          </nav>

          <div>
            <p className="eyebrow mb-2">{t("footer.layerTable")}</p>
            <Citation evidence={evidenceTable.row} />
          </div>
        </div>
      </div>
    </footer>
  );
}
