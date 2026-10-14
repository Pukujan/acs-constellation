import { Link, NavLink } from "react-router-dom";

import { ACS_REPOSITORY_URL, t } from "@/lib/content";

const links = [
  { to: "/map", label: t("nav.map") },
  { to: "/prd", label: t("nav.prd") },
];

/**
 * Sits over the hero sky rather than above it: the canvas runs behind this
 * bar, so the field stays translucent and only blurred enough to keep the
 * links legible against moving stars.
 */
export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[hsl(var(--biscay-line)/0.55)] bg-[hsl(var(--biscay-deep)/0.55)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          to="/"
          className="group flex min-w-0 items-center gap-3"
          aria-label={t("nav.home")}
        >
          <img
            src="/generated-1791916189237-77bb5521779d.png"
            alt={t("nav.logoAlt")}
            className="h-9 w-9 shrink-0 rounded-full border border-[hsl(var(--studio))] object-cover"
            width={36}
            height={36}
          />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="font-display text-lg tracking-tight text-[hsl(var(--whisper))]">
              {t("nav.brand")}
            </span>
            <span className="hidden truncate font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))] sm:block">
              {t("nav.brandExpanded")}
            </span>
          </span>
        </Link>

        <nav
          aria-label={t("nav.brandExpanded")}
          className="ml-auto flex items-center gap-1 sm:gap-2"
        >
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] transition-colors ${
                  isActive
                    ? "bg-[hsl(var(--studio))] text-[hsl(var(--whisper))]"
                    : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--whisper))]"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
          <a
            href={ACS_REPOSITORY_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-[hsl(var(--twine)/0.6)] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-[hsl(var(--twine))] hover:bg-[hsl(var(--twine)/0.12)]"
          >
            {t("nav.repo")}
          </a>
        </nav>
      </div>
    </header>
  );
}
