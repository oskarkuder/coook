import { PLAN } from "@/lib/entitlements";

export const metadata = { title: "Terms — Coook!" };

export default function TermsPage() {
  return (
    <div className="page prose-neutral">
      <h1 className="h1">Terms of service</h1>
      <p className="meta mt-2">Last updated: 17 August 2026</p>

      <div className="mt-8 space-y-6 text-[15px] leading-relaxed">
        <section>
          <h2 className="h2">What Coook! does</h2>
          <p className="mt-2">
            Coook! reads a public cooking video you link to and produces a
            written recipe from its caption and spoken audio. The recipe is
            generated automatically and is an interpretation, not a copy of the
            creator&apos;s work.
          </p>
        </section>

        <section>
          <h2 className="h2">Accuracy</h2>
          <p className="mt-2">
            Ingredient amounts, cooking times and nutrition figures are
            estimates produced by an AI model. They can be wrong. Use your own
            judgement, especially with cooking temperatures, allergens and raw
            ingredients. Nutrition figures are not medical or dietary advice.
          </p>
        </section>

        <section>
          <h2 className="h2">Your account</h2>
          <p className="mt-2">
            You are responsible for what happens under your account. Do not use
            Coook! to reproduce or redistribute other people&apos;s content
            commercially.
          </p>
        </section>

        <section>
          <h2 className="h2">Payment</h2>
          <p className="mt-2">
            The subscription is ${PLAN.priceUsd} per month, billed by Stripe
            until you cancel. Cancelling stops future charges and keeps your
            access until the end of the period you already paid for. Past
            periods are not refunded automatically — email us and we will sort
            it out.
          </p>
        </section>

        <section>
          <h2 className="h2">Ending things</h2>
          <p className="mt-2">
            You can delete your account at any time from the Account page. That
            removes your recipes, meal plan and shopping list, and cancels any
            active subscription.
          </p>
        </section>
      </div>

      <p className="meta mt-10">
        These terms are a plain-language starting point. Have a lawyer review
        them before you take real payments at scale.
      </p>
    </div>
  );
}
