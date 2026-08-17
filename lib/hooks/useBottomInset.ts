"use client";

import { useEffect, useState } from "react";

/**
 * How many pixels of the layout viewport are currently hidden at the bottom —
 * iOS Safari's toolbar, or the on-screen keyboard.
 *
 * Anything pinned to the bottom on mobile (the tab bar, any sheet that slides
 * up) must be lifted by this, or Safari's address bar sits on top of it.
 */
export function useBottomInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setInset(
          Math.max(
            0,
            Math.round(window.innerHeight - viewport.height - viewport.offsetTop),
          ),
        );
      });
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
