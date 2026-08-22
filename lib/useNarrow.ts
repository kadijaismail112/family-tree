"use client";

import { useEffect, useState } from "react";

/** True below Tailwind's `sm` (640px) — portrait phones, not landscape ones. */
export function useNarrow(query = "(max-width: 639px)") {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [query]);
  return narrow;
}
