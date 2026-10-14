import type { ReactNode } from "react";

import SiteFooter from "./SiteFooter";
import SiteHeader from "./SiteHeader";
import { t } from "@/lib/content";
import { useScrollDepth } from "@/hooks/use-scroll-depth";

/**
 * The page-level sky. Three star layers scroll at different rates so the page
 * reads as depth rather than as length. Mona only: a Biscay field with Whisper
 * and Twine points. No photographic plate, no warm/cool two-tone.
 */
export default function Layout({ children }: { children: ReactNode }) {
  useScrollDepth();

  return (
    <div className="relative min-h-screen">
      <div className="sky-plate" aria-hidden="true">
        <div className="sky-layer sky-far" />
        <div className="sky-layer sky-mid" />
        <div className="sky-layer sky-near" />
      </div>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-[hsl(var(--twine))] focus:px-4 focus:py-2 focus:text-sm focus:text-[hsl(var(--biscay-deep))]"
      >
        {t("nav.skip")}
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}
