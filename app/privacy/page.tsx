export const metadata = { title: "Privacy — Coook!" };

export default function PrivacyPage() {
  return (
    <div className="page">
      <h1 className="h1">Privacy</h1>
      <p className="meta mt-2">Last updated: 17 August 2026</p>

      <div className="mt-8 space-y-6 text-[15px] leading-relaxed">
        <section>
          <h2 className="h2">What is stored</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Your email address, so you can sign in.</li>
            <li>
              The video links you submit, plus the caption, transcript and
              recipe generated from each one.
            </li>
            <li>Your meal plan and shopping list.</li>
            <li>
              A Stripe customer ID and your subscription status. Card details
              are handled by Stripe and never reach our servers.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="h2">Who else sees it</h2>
          <p className="mt-2">
            Supabase hosts the database and authentication. Vercel hosts the
            app. OpenAI receives the caption and audio of the videos you submit
            in order to produce the recipe. Stripe handles payment. Nobody else
            gets your data, and it is never sold.
          </p>
        </section>

        <section>
          <h2 className="h2">Other people&apos;s videos</h2>
          <p className="mt-2">
            Coook! only reads posts that are already public. It does not log in
            to any social platform on your behalf and does not store the video
            files themselves.
          </p>
        </section>

        <section>
          <h2 className="h2">Deleting your data</h2>
          <p className="mt-2">
            Delete your account on the Account page and everything above is
            removed from the database immediately, apart from the billing
            records Stripe is legally required to keep.
          </p>
        </section>
      </div>

      <p className="meta mt-10">
        This is a plain-language summary written for a small app. Review it
        against GDPR requirements before launching in the EU.
      </p>
    </div>
  );
}
