import { NextResponse } from "next/server";
import { getApiSession, unauthorized, badRequest } from "@/lib/api/session";
import { getStore } from "@/lib/data";
import { formatIngredient } from "@/lib/recipes/scale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SYSTEM = `You are a calm, practical cooking assistant talking to someone who is cooking RIGHT NOW, hands busy, phone on the counter.

- Answer in 1-3 short sentences. No preamble, no lists unless asked.
- Ground every answer in the recipe you are given. If the recipe does not say, say what a cook would normally do and make clear it is your suggestion.
- Substitutions, timings, "is it done yet", technique and rescue questions are all fair game.
- Be specific about senses: what it should look, smell and sound like.
- Never invent a step that contradicts the recipe.`;

type Message = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  const { user } = await getApiSession();
  if (!user) return unauthorized();

  let body: {
    recipeId?: string;
    question?: string;
    stepIndex?: number;
    servings?: number;
    history?: Message[];
  };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request body.");
  }

  const question = body.question?.trim();
  if (!question) return badRequest("Ask a question first.");
  if (!body.recipeId) return badRequest("Missing recipe.");

  const recipe = await getStore().getRecipe(user.id, body.recipeId);
  if (!recipe) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({
      answer:
        "The assistant needs an OpenAI API key to answer. Add OPENAI_API_KEY to .env.local and restart — the step-by-step guide, timers and the rest all work without it.",
      configured: false,
    });
  }

  const servings = body.servings ?? recipe.base_servings;
  const ingredients = recipe.ingredients
    .map((item) => {
      const line = formatIngredient(item, recipe.base_servings, servings);
      return `- ${[line.amount, line.name].filter(Boolean).join(" ")}${line.note ? ` (${line.note})` : ""}`;
    })
    .join("\n");

  const steps = recipe.steps
    .map((step, index) => `${index + 1}. ${step.text}`)
    .join("\n");

  const stepIndex = body.stepIndex ?? 0;
  const currentStep = recipe.steps[stepIndex];

  const context = `RECIPE: ${recipe.title}
Serving ${servings} (the video's amounts were for ${recipe.base_servings}).

INGREDIENTS
${ingredients}

STEPS
${steps}

They are currently on step ${stepIndex + 1}: ${currentStep?.text ?? "not started yet"}`;

  const history = (body.history ?? [])
    .filter((m) => m && typeof m.content === "string")
    .slice(-6)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }));

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
        temperature: 0.4,
        max_tokens: 300,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "system", content: context },
          ...history,
          { role: "user", content: question.slice(0, 800) },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      console.error("assistant failed", response.status, await response.text());
      return NextResponse.json(
        { error: "The assistant is unavailable right now." },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      return NextResponse.json({ error: "Empty answer." }, { status: 502 });
    }

    return NextResponse.json({ answer, configured: true });
  } catch (error) {
    console.error("assistant error", error);
    return NextResponse.json(
      { error: "Could not reach the assistant." },
      { status: 502 },
    );
  }
}
