import { useState } from "react";

import { ProblemSky } from "@/components/Skies";
import { components, layerByComponent, t, type CopyKey } from "@/lib/content";

/**
 * Five layer names down the left, the sky on the right. Moving through the
 * list highlights that layer's cluster and re-frames the camera on it, so the
 * stack is walked by pointing at it rather than by reading about it.
 */
export default function LayerDiagram() {
  const [focus, setFocus] = useState<string>("acs");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const focused = components.find((c) => c.id === focus);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:items-start">
      <div className="lg:sticky lg:top-40 lg:self-start">
        <p className="eyebrow mb-3">{t("stack.pills.eyebrow")}</p>
        <ul className="flex gap-2 overflow-x-auto pb-2 lg:grid lg:gap-1.5 lg:overflow-visible lg:pb-0">
          {components.map((c) => (
            <li key={c.id} className="shrink-0 lg:shrink">
              <button
                type="button"
                className="layer-pill"
                aria-pressed={focus === c.id}
                onClick={() => setFocus(c.id)}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full bg-layer-${c.id}`}
                  aria-hidden="true"
                />
                <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em]">
                  {c.name}
                </span>
                <span className="hidden truncate text-sm sm:inline">
                  {layerByComponent.get(c.id)}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-5 hidden lg:block">
          <p className="font-display text-lg leading-snug text-[hsl(var(--whisper))]">
            {t(`stack.${focus}.heading` as CopyKey)}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
            {focused?.owns}
          </p>
        </div>
      </div>

      <div className="relative min-h-[380px] sm:min-h-[460px] lg:min-h-[560px]">
        <div className="absolute inset-0">
          <ProblemSky
            hotloader
            focus={focus}
            selectedId={selectedId}
            onSelect={setSelectedId}
            homeDistance={24}
          />
        </div>
      </div>

      <div className="lg:col-span-2">
        <p className="font-display text-lg leading-snug text-[hsl(var(--whisper))] sm:hidden">
          {t(`stack.${focus}.heading` as CopyKey)}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))] sm:hidden">
          {focused?.owns}
        </p>
      </div>
    </div>
  );
}
