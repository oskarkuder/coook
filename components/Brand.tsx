/* eslint-disable @next/next/no-img-element */

/**
 * The mark, cut from the brand sheet. Kept as one component so a new logo file
 * only has to be swapped in one place.
 */
export function Wordmark({
  className = "h-9 w-auto",
  variant = "dark",
}: {
  className?: string;
  variant?: "dark" | "light";
}) {
  return (
    <img
      src={variant === "dark" ? "/brand/wordmark-dark.png" : "/brand/wordmark-light.png"}
      alt="Coook!"
      className={className}
      draggable={false}
    />
  );
}

export function AppIcon({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <img
      src="/brand/icon-round.png"
      alt=""
      aria-hidden
      className={className}
      draggable={false}
    />
  );
}

export function Sticker({ className = "h-24 w-auto" }: { className?: string }) {
  return (
    <img
      src="/brand/sticker.png"
      alt="Coook!"
      className={className}
      draggable={false}
    />
  );
}
