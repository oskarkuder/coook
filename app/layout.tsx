import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { BottomTabs, TopBar } from "@/components/Nav";
import { DemoBanner } from "@/components/DemoBanner";
import { getUserAndProfile } from "@/lib/supabase/serverUser";
import { getEntitlement } from "@/lib/entitlements";

export const metadata: Metadata = {
  title: "Coook! — turn cooking videos into recipes",
  description:
    "Paste a TikTok, Reel or Short and get the full recipe: ingredients with amounts, steps, calories and a weekly meal plan.",
  applicationName: "Coook!",
  appleWebApp: { capable: true, title: "Coook!", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getUserAndProfile();
  const signedIn = Boolean(user);
  const entitlement = user ? getEntitlement(profile) : null;

  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-ink antialiased">
        <TopBar signedIn={signedIn} entitlement={entitlement} />
        <DemoBanner />
        <main>{children}</main>
        <BottomTabs signedIn={signedIn} />
        <Analytics />
      </body>
    </html>
  );
}
