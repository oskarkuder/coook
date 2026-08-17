"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/Brand";
import { FreeCounter } from "@/components/FreeCounter";
import { useBottomInset } from "@/lib/hooks/useBottomInset";
import {
  CalendarIcon,
  CartIcon,
  HomeIcon,
  LibraryIcon,
  PersonIcon,
  PlusIcon,
} from "@/components/icons";
import type { Entitlement } from "@/lib/entitlements";

type NavItem = {
  href: string;
  label: string;
  Icon: (props: { className?: string }) => React.ReactElement;
};

/**
 * Five tabs, in the order the app is actually used: make one, keep them,
 * plan the week, buy the food, settings.
 */
const ITEMS: NavItem[] = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/library", label: "Library", Icon: LibraryIcon },
  { href: "/plan", label: "Plan", Icon: CalendarIcon },
  { href: "/shopping", label: "Shopping", Icon: CartIcon },
  { href: "/account", label: "Account", Icon: PersonIcon },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/library") {
    return (
      pathname.startsWith("/library") ||
      pathname.startsWith("/category") ||
      pathname.startsWith("/recipe")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopBar({
  signedIn,
  entitlement,
}: {
  signedIn: boolean;
  entitlement: Entitlement | null;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-wide items-center justify-between gap-6 px-5">
        <Link href="/" aria-label="Coook! home" className="flex shrink-0 items-center">
          <Wordmark className="h-9 w-auto" />
        </Link>

        {signedIn ? (
          <>
            {/* Pill nav: icon + label, with a filled pill on the current tab so
                there is never a question about where you are. */}
            <nav className="hidden items-center gap-1 rounded-full border border-line bg-surface p-1 md:flex">
              {ITEMS.map(({ href, label, Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-[15px] transition-colors ${
                      active
                        ? "bg-white font-medium text-ink shadow-sm ring-1 ring-line"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {label}
                  </Link>
                );
              })}
            </nav>

            <Link href="/" className="btn-accent btn-sm hidden shrink-0 md:inline-flex">
              New recipe
            </Link>

            {/* Mobile: the tab bar handles navigation, so the top-right earns
                its space by answering "how many free recipes are left?". */}
            <div className="flex shrink-0 items-center gap-2 md:hidden">
              {entitlement ? (
                <Link href="/pricing" aria-label="Your plan">
                  <FreeCounter entitlement={entitlement} compact />
                </Link>
              ) : null}
              {pathname !== "/" ? (
                <Link
                  href="/"
                  aria-label="New recipe"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-ink"
                >
                  <PlusIcon className="h-5 w-5" />
                </Link>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn-ghost btn-sm">
              Sign in
            </Link>
            <Link href="/signup" className="btn-accent btn-sm">
              Get started
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

export function BottomTabs({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  // iOS Safari's toolbar sits on top of `position: fixed; bottom: 0`, so lift
  // the bar by however much of the viewport it is covering.
  const bottomInset = useBottomInset();

  if (!signedIn) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)] transition-transform duration-150 md:hidden"
      style={{ transform: bottomInset ? `translateY(-${bottomInset}px)` : undefined }}
    >
      {/* Floating pill. Same colours as the desktop nav: a surface-grey track
          with the current tab raised as a white pill. */}
      <div className="mx-3 mb-3 rounded-full border border-line bg-surface p-1 shadow-[0_6px_24px_rgba(0,0,0,0.10)]">
        <div className="grid grid-cols-5">
          {ITEMS.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 rounded-full py-2 text-[10px] transition-colors ${
                  active
                    ? "bg-white font-medium text-ink shadow-sm ring-1 ring-line"
                    : "text-muted"
                }`}
              >
                <Icon className="h-[20px] w-[20px]" />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
