import type { Step } from "@/lib/types";

/**
 * A timer is only worth showing when the step is something you wait through —
 * boiling pasta, baking, resting dough. Chopping an onion has a duration too,
 * but nobody sets a timer for it, and a countdown on every step turns the
 * useful ones into noise.
 */

/** Things you leave alone and come back to. */
const TIMED_ACTIONS =
  /\b(boil|simmer|bake|roast|boil|steam|poach|braise|stew|fry|deep.?fry|sear|saut[ée]|grill|broil|toast|caramelis|carameliz|reduce|rest|chill|refrigerat|freeze|marinat|steep|infuse|prove|proof|rise|soak|set aside|leave|cook|microwave|preheat|blanch|simmering)\b/i;

/** Hands-on work — mentioning a duration does not make it a timer. */
const PREP_ACTIONS =
  /\b(chop|dice|slice|mince|grate|peel|trim|whisk|beat|stir|mix|combine|fold|season|serve|garnish|plate|assemble|drain|rinse|transfer|arrange|sprinkle|drizzle|top with|scatter)\b/i;

/** Below this, a countdown is more hassle than just watching the pan. */
const MIN_MINUTES = 2;

export function stepHasUsefulTimer(step: Step): boolean {
  if (!step.minutes || step.minutes < MIN_MINUTES) return false;

  const text = step.text ?? "";
  if (!TIMED_ACTIONS.test(text)) return false;

  // "Chop the onion, then simmer for 20 minutes" still deserves a timer, so a
  // prep verb only disqualifies a step when there is no waiting verb at all.
  if (PREP_ACTIONS.test(text) && !TIMED_ACTIONS.test(text)) return false;

  return true;
}
