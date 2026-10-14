import { useState } from "react";
import { Link } from "react-router-dom";

import { ProblemSky } from "./Skies";
import RecordSurface, { EmptyRecord } from "./RecordSurface";
import { ProblemRecord } from "./RecordPanel";
import { ACS_REPOSITORY_URL, problems, t } from "@/lib/content";

/**
 * The constellation is the hero, not a figure inside it. The canvas fills the
 * section edge to edge and the copy sits on top of it over a scrim, so the
 * hotloader and its orbit are never boxed.
 */
export default function HeroSky() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = problems.find((p) => p.id === selectedId);
  const body = selected ? <ProblemRecord problem={selected} /> : <EmptyRecord />;

  return (
    <section className="hero-shell" aria-labelledby="hero-heading">
      <div className="hero-canvas">
        <ProblemSky
          selectedId={selectedId}
          onSelect={setSelectedId}
          resetSignal={0}
          hotloader
          parallax
          intro
          homeDistance={18}
        />
      </div>
      <div className="hero-scrim" aria-hidden="true" />

      {/*
        The copy column floats over the sky, so it must not swallow the pointer.
        The column is transparent to hits and each control opens itself back up,
        which leaves every gap between them — and the whole lower hero — tappable.
      */}
      <div className="pointer-events-none relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-8 pt-20 sm:px-6 lg:pt-24 xl:px-10">
        <div className="rise max-w-[34rem] lg:max-w-[31%]">
          <h1
            id="hero-heading"
            className="font-display text-[2.4rem] leading-[1.02] text-[hsl(var(--whisper))] sm:text-5xl lg:text-[3.2rem]"
          >
            {t("hero.headline")}
          </h1>
          <p className="mt-5 text-[1.0625rem] leading-relaxed text-[hsl(var(--whisper)/0.82)] sm:text-lg">
            {t("hero.subhead")}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link to="/map" className="btn-hot pointer-events-auto">
              {t("hero.cta")}
            </Link>
            <Link to="/prd" className="link-quiet pointer-events-auto text-sm">
              {t("hero.link.prd")}
            </Link>
            <a
              href={ACS_REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
              className="link-quiet pointer-events-auto text-sm"
            >
              {t("hero.link.repo")}
            </a>
          </div>

        </div>

        {/* Mobile: the copy ends and the sky keeps going below it. */}
        <div className="pointer-events-none min-h-[34dvh] flex-1 lg:hidden" aria-hidden="true" />

        {selected && (
          <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 hidden lg:inset-x-auto lg:right-6 lg:bottom-8 lg:block lg:w-[23rem] lg:pointer-events-auto xl:right-10">
            <RecordSurface
              open
              onClose={() => setSelectedId(null)}
              title={selected.problem}
              inline={body}
              overSky
            >
              {body}
            </RecordSurface>
          </div>
        )}
      </div>
    </section>
  );
}
