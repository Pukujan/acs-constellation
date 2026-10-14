import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";

import Block from "@/components/Block";
import BigNumber from "@/components/BigNumber";
import HeroSky from "@/components/HeroSky";
import Layout from "@/components/Layout";
import LayerDiagram from "@/components/LayerDiagram";
import RichText from "@/components/RichText";
import ResearchSection from "@/components/ResearchSection";
import SectionTabs, { type SectionId } from "@/components/SectionTabs";
import { BeforeAfterFigure, DriftFigure, HotloaderFigure, StackTable } from "@/components/Figures";
import {
  ACS_REPOSITORY_URL,
  research,
  t,
  tList,
  type CopyKey,
} from "@/lib/content";

const NOCTURNE = "/generated-1791916248176-ef527f3c861d.png";
const DAWN = "/generated-1791916493030-0bbdbe3fc2cc.png";

const DEMO_STEPS = ["demo.step1", "demo.step2", "demo.step3"];

function useTitle() {
  useEffect(() => {
    document.title = `${t("nav.brand")} — ${t("nav.brandExpanded")}`;
  }, []);
}

/** A large figure with one label and its citation, nothing between them. */
function ImpactFigures() {
  const pcm = research.components.find((c) => c.id === "pcm");
  const acs = research.components.find((c) => c.id === "acs");
  const train = research.components.find((c) => c.id === "train");

  const write = pcm?.figures?.find((f) => f.key === "writeOmissions");
  const visibility = acs?.figures?.find((f) => f.key === "visibility");
  const pinFiles = train?.figures?.find((f) => f.key === "pinFiles");

  return (
    <div className="grid gap-8 sm:grid-cols-3">
      {write && (
        <BigNumber figure={write} label={t("research.pcm.statWriteLabel")} />
      )}
      {visibility && (
        <BigNumber figure={visibility} label={t("research.acs.statVisibilityLabel")} />
      )}
      {pinFiles && (
        <BigNumber figure={pinFiles} label={t("research.train.statFilesLabel")} />
      )}
    </div>
  );
}

export default function Index() {
  useTitle();
  const [params, setParams] = useSearchParams();
  const raw = params.get("section");
  const section: SectionId =
    raw === "stack" || raw === "research" || raw === "demo" || raw === "problem"
      ? raw
      : "problem";
  const setSection = (next: SectionId) =>
    setParams({ section: next }, { replace: true });

  return (
    <Layout>
      {/* The constellation is the page: full-bleed, behind the header, with the
          ACS Hotloader turning at its centre. */}
      <HeroSky />

      <SectionTabs active={section} onChange={setSection} />

      <div key={section} className="rise" data-parallax>
        {section === "problem" && (
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <Block
              id="intro"
              eyebrow={t("block.intro.eyebrow")}
              image={NOCTURNE}
              imageAltKey="block.intro.imageAlt"
              captionKey="block.intro.caption"
              reverse
            />
            <div className="mt-4">
              <DriftFigure />
            </div>
            <div className="mt-16 border-t border-[hsl(var(--biscay-line))] pt-12">
              <h2 className="font-display text-[1.65rem] leading-[1.15] text-[hsl(var(--whisper))] sm:text-4xl">
                {t("block.impact.heading")}
              </h2>
              <p className="mt-4 max-w-2xl text-[1.0125rem] leading-relaxed text-[hsl(var(--muted-foreground))]">
                <RichText text={t("block.impact.body")} />
              </p>
              <div className="mt-10">
                <ImpactFigures />
              </div>
            </div>
          </div>
        )}

        {section === "stack" && (
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <h2 className="max-w-3xl font-display text-[1.65rem] leading-[1.15] text-[hsl(var(--whisper))] sm:text-4xl">
              {t("block.answer.heading")}
            </h2>
            <p className="mt-4 max-w-2xl text-[1.0125rem] leading-relaxed text-[hsl(var(--muted-foreground))]">
              <RichText text={t("block.answer.body")} />
            </p>

            <div className="mt-10">
              <HotloaderFigure />
            </div>

            <div className="mt-14">
              <LayerDiagram />
            </div>

            <div className="mt-14">
              <p className="eyebrow mb-4">{t("stack.pills.eyebrow")}</p>
              <StackTable />
            </div>

            <div className="mt-14">
              <BeforeAfterFigure />
            </div>
          </div>
        )}

        {section === "research" && (
          <div className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6 sm:pb-20">
            <ResearchSection />
            <div className="plate mt-6 max-w-3xl p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-3">
                <p className="eyebrow">{t("block.measure.tag")}</p>
                <p className="tag rounded-full border-[hsl(var(--layer-cgm))] text-[hsl(var(--layer-cgm))]">
                  {t("block.measure.tagNote")}
                </p>
              </div>
              <h2 className="mt-4 font-display text-[1.65rem] leading-[1.15] text-[hsl(var(--whisper))] sm:text-4xl">
                {t("block.measure.heading")}
              </h2>
              <p className="mt-5 text-[1.0125rem] leading-relaxed text-[hsl(var(--muted-foreground))]">
                <RichText text={t("block.measure.body")} />
              </p>
            </div>
          </div>
        )}

        {section === "demo" && (
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
              <div>
                <h2 className="font-display text-[1.65rem] leading-[1.15] text-[hsl(var(--whisper))] sm:text-4xl">
                  {t("demo.heading")}
                </h2>
                <p className="mt-4 max-w-prose text-[1.0125rem] leading-relaxed text-[hsl(var(--muted-foreground))]">
                  {t("demo.body")}
                </p>

                <ol className="mt-8 grid gap-5">
                  {DEMO_STEPS.map((key, index) => (
                    <li key={key} className="flex gap-4">
                      <span
                        aria-hidden="true"
                        className="mt-1 font-display text-2xl leading-none text-[hsl(var(--twine))]"
                      >
                        {index + 1}
                      </span>
                      <div>
                        <h3 className="font-display text-lg text-[hsl(var(--whisper))]">
                          {t(`${key}.heading` as CopyKey)}
                        </h3>
                        <p className="mt-1 max-w-prose text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                          {t(`${key}.body` as CopyKey)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>

                <div className="mt-8 grid gap-5 border-t border-[hsl(var(--biscay-line))] pt-6 sm:grid-cols-2">
                  <div>
                    <h3 className="font-display text-lg text-[hsl(var(--whisper))]">
                      {t("demo.how.heading")}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                      {t("demo.how.body")}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-display text-lg text-[hsl(var(--whisper))]">
                      {t("demo.use.heading")}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                      {t("demo.use.body")}
                    </p>
                    <Link to="/map" className="link-quiet mt-2 inline-block text-sm">
                      {t("block.next.map")}
                    </Link>
                  </div>
                </div>
              </div>

              <figure className="grid gap-2">
                <div className="duotone border border-[hsl(var(--border))]">
                  <img
                    src={DAWN}
                    alt={t("demo.imageAlt")}
                    loading="lazy"
                    decoding="async"
                    className="h-auto w-full object-cover"
                  />
                </div>
                <figcaption className="text-sm italic text-[hsl(var(--muted-foreground))]">
                  {t("demo.imageCaption")}
                </figcaption>
              </figure>
            </div>

            <div className="mt-16 grid gap-8 border-t border-[hsl(var(--biscay-line))] pt-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div>
                <h2 className="font-display text-[1.65rem] leading-[1.15] text-[hsl(var(--whisper))] sm:text-4xl">
                  {t("block.boundaries.heading")}
                </h2>
                <p className="mt-5 text-[1.0125rem] leading-relaxed text-[hsl(var(--muted-foreground))]">
                  {t("block.boundaries.body")}
                </p>
                <p className="cite mt-4">{t("block.boundaries.proof")}</p>
              </div>
              <ul className="grid gap-3">
                {tList("block.boundaries.items").map((item) => (
                  <li
                    key={item}
                    className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-4 text-sm leading-relaxed text-[hsl(var(--whisper)/0.85)]"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="plate mt-16 p-6 sm:p-10">
              <h2 className="max-w-3xl font-display text-[1.65rem] leading-[1.15] text-[hsl(var(--whisper))] sm:text-4xl">
                {t("block.next.heading")}
              </h2>
              <p className="mt-5 max-w-2xl text-[1.0125rem] leading-relaxed text-[hsl(var(--muted-foreground))]">
                {t("block.next.body")}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
                <Link to="/map" className="link-quiet text-sm">
                  {t("block.next.map")}
                </Link>
                <Link to="/prd" className="link-quiet text-sm">
                  {t("block.next.prd")}
                </Link>
                <a
                  href={ACS_REPOSITORY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="link-quiet text-sm"
                >
                  {t("block.next.repo")}
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
