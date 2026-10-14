import { useEffect } from "react";

/**
 * Publishes the scroll offset as `--sy` on the document element, so the star
 * layers and the hero canvas can move at different rates. Under
 * prefers-reduced-motion nothing is written, and the CSS leaves every layer
 * where it started.
 */
export function useScrollDepth(): void {
  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const write = () => {
      frame = 0;
      if (reduced.matches) {
        root.style.removeProperty("--sy");
        return;
      }
      root.style.setProperty("--sy", String(Math.min(window.scrollY, 4000)));
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(write);
    };

    write();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      root.style.removeProperty("--sy");
    };
  }, []);
}
