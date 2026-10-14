import { useEffect, useState } from "react";

/**
 * Window scroll offset, published as a CSS custom property length so parallax
 * can happen in the stylesheet instead of a per-frame React render. Frozen at
 * zero when the reader asks for reduced motion.
 */
export function useScrollY(): number {
  const [y, setY] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setY(window.scrollY);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return y;
}
