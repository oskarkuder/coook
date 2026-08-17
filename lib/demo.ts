import type { Profile, Recipe } from "@/lib/types";

/**
 * Demo mode runs the whole app against an in-memory store with a fake signed-in
 * user, so you can click through every screen before Supabase, Stripe or Vercel
 * exist. Flip NEXT_PUBLIC_DEMO_MODE to 0 (or remove it) to go back to the real
 * backend — no other change is needed.
 */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "1";
}

export const DEMO_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "you@demo.local",
};

export const DEMO_PROFILE: Profile = {
  id: DEMO_USER.id,
  email: DEMO_USER.email,
  full_name: "Demo cook",
  free_extractions_used: 0,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  // Subscribed so the paywall stays out of the way while you look around.
  // Set this to null to see the free-tier and paywall screens instead.
  subscription_status: "active",
  subscription_current_period_end: null,
  cancel_at_period_end: false,
  created_at: new Date(0).toISOString(),
};

const now = new Date().toISOString();

/** Two recipes so history, saved, the plan and the shopping list are not empty. */
export const DEMO_RECIPES: Recipe[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: DEMO_USER.id,
    status: "ready",
    error_code: null,
    error_message: null,
    source_url: "https://www.tiktok.com/@demo/video/1",
    source_platform: "tiktok",
    source_author: "spicyweeknights",
    source_thumbnail_url: null,
    source_caption: null,
    source_transcript: null,
    title: "Gochujang butter noodles",
    summary:
      "Sticky, savoury noodles that come together in the time the water boils.",
    cuisine: "Korean-ish",
    difficulty: "easy",
    base_servings: 2,
    prep_minutes: 5,
    cook_minutes: 10,
    ingredients: [
      { name: "dried udon noodles", quantity: 200, unit: "g", note: null },
      { name: "unsalted butter", quantity: 45, unit: "g", note: null },
      { name: "gochujang", quantity: 2, unit: "tbsp", note: null },
      { name: "soy sauce", quantity: 1, unit: "tbsp", note: null },
      { name: "honey", quantity: 2, unit: "tsp", note: null },
      { name: "garlic", quantity: 3, unit: "clove", note: "finely grated" },
      { name: "spring onions", quantity: 2, unit: "piece", note: "sliced thin" },
      { name: "toasted sesame seeds", quantity: null, unit: null, note: "to finish" },
    ],
    steps: [
      { text: "Boil the noodles in well-salted water until just tender.", minutes: 6 },
      { text: "Melt the butter in a wide pan over medium heat and cook the garlic for 30 seconds.", minutes: 1 },
      { text: "Stir in the gochujang, soy sauce and honey until it turns glossy.", minutes: 1 },
      { text: "Add the drained noodles with a splash of the cooking water and toss until every strand is coated.", minutes: 2 },
      { text: "Finish with spring onions and sesame seeds.", minutes: null },
    ],
    nutrition: { calories: 612, protein_g: 14, carbs_g: 82, fat_g: 24 },
    confidence: "high",
    is_saved: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    user_id: DEMO_USER.id,
    status: "ready",
    error_code: null,
    error_message: null,
    source_url: "https://www.instagram.com/reel/demo2/",
    source_platform: "instagram",
    source_author: "onepanjules",
    source_thumbnail_url: null,
    source_caption: null,
    source_transcript: null,
    title: "One-pan lemon chicken and orzo",
    summary: "Everything cooks in one pan and the orzo drinks up all the good stuff.",
    cuisine: "Mediterranean",
    difficulty: "easy",
    base_servings: 4,
    prep_minutes: 10,
    cook_minutes: 25,
    ingredients: [
      { name: "chicken thighs", quantity: 800, unit: "g", note: "bone-in, skin-on" },
      { name: "orzo", quantity: 300, unit: "g", note: null },
      { name: "chicken stock", quantity: 700, unit: "ml", note: "hot" },
      { name: "lemon", quantity: 1, unit: "piece", note: "zest and juice" },
      { name: "garlic", quantity: 4, unit: "clove", note: "sliced" },
      { name: "olive oil", quantity: 2, unit: "tbsp", note: null },
      { name: "baby spinach", quantity: 100, unit: "g", note: null },
      { name: "salt", quantity: null, unit: null, note: "to taste" },
    ],
    steps: [
      { text: "Season the chicken well and brown it skin-side down in the oil until deeply golden.", minutes: 8 },
      { text: "Lift the chicken out and soften the garlic in the rendered fat.", minutes: 2 },
      { text: "Stir in the orzo, then pour over the hot stock and lemon juice.", minutes: 1 },
      { text: "Sit the chicken back on top and bake at 200°C until the orzo is tender.", minutes: 20 },
      { text: "Fold the spinach through the orzo and finish with lemon zest.", minutes: 2 },
    ],
    nutrition: { calories: 578, protein_g: 41, carbs_g: 55, fat_g: 21 },
    confidence: "high",
    is_saved: false,
    created_at: new Date(Date.now() - 86_400_000).toISOString(),
    updated_at: new Date(Date.now() - 86_400_000).toISOString(),
  },
];

/** Returned by the extract route when there is no OpenAI key to call. */
export const DEMO_SAMPLE_EXTRACTION = {
  title: "Crispy chilli halloumi bowls",
  summary: "Golden halloumi, a hot honey glaze and whatever grain you have in.",
  cuisine: "Fusion",
  difficulty: "easy" as const,
  servings: 2,
  prep_minutes: 10,
  cook_minutes: 12,
  ingredients: [
    { name: "halloumi", quantity: 225, unit: "g", note: "cut into thick fingers" },
    { name: "cornflour", quantity: 2, unit: "tbsp", note: null },
    { name: "honey", quantity: 2, unit: "tbsp", note: null },
    { name: "chilli flakes", quantity: 1, unit: "tsp", note: null },
    { name: "cooked rice", quantity: 400, unit: "g", note: "warm" },
    { name: "cucumber", quantity: 1, unit: "piece", note: "sliced" },
    { name: "lime", quantity: 1, unit: "piece", note: "juiced" },
    { name: "olive oil", quantity: 2, unit: "tbsp", note: null },
  ],
  steps: [
    { text: "Toss the halloumi in cornflour until every side is dusted.", minutes: 2 },
    { text: "Fry in hot oil, turning once, until deeply golden and crisp.", minutes: 6 },
    { text: "Kill the heat, add the honey and chilli flakes, and toss to glaze.", minutes: 1 },
    { text: "Pile onto the rice with the cucumber and squeeze over the lime.", minutes: 2 },
  ],
  nutrition_per_serving: { calories: 704, protein_g: 29, carbs_g: 74, fat_g: 32 },
  confidence: "high" as const,
};
