import { useEffect, useState } from "react";

/** True below the given CSS pixel width. Used for the bottom-sheet breakpoint. */
export function useNarrow(breakpoint = 640): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = (event: MediaQueryListEvent) => setNarrow(event.matches);
    query.addEventListener("change", onChange);
    setNarrow(query.matches);
    return () => query.removeEventListener("change", onChange);
  }, [breakpoint]);

  return narrow;
}
