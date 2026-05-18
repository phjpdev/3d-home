"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/generate", label: "Generate model" },
  { href: "/edit", label: "Edit home" },
  { href: "/walk", label: "Walk home" },
] as const;

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  /** Full viewport with no footer scroll chrome over the canvas */
  const isExperienceRoute = pathname === "/edit" || pathname === "/walk";

  const rootCls = isExperienceRoute
    ? "flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[var(--museum-paper)] text-[var(--museum-ink)]"
    : "flex min-h-[100dvh] flex-col bg-[var(--museum-paper)] text-[var(--museum-ink)]";

  return (
    <div className={rootCls}>
      <header className="border-b border-[var(--museum-rule)] bg-[var(--museum-parchment)]/90 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:gap-6">
          <Link
            href="/"
            className="museum-serif text-lg tracking-tight text-[var(--museum-ink)] transition hover:text-[var(--museum-brass-dark)]"
          >
            Einstein House
            <span className="mt-0.5 block text-[10px] font-sans font-normal uppercase tracking-[0.22em] text-[var(--museum-muted)]">
              period room · digital
            </span>
          </Link>
          <nav
            className="flex flex-wrap items-center justify-end gap-1 sm:gap-2"
            aria-label="Primary"
          >
            {navLinks.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`museum-nav rounded-sm px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--museum-brass)] ${
                    active
                      ? "bg-[var(--museum-ink-soft)] text-[var(--museum-paper)]"
                      : "text-[var(--museum-ink)] hover:bg-black/[0.04]"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main
        className={
          isExperienceRoute
            ? "flex min-h-0 flex-1 flex-col overflow-hidden"
            : "flex min-h-0 flex-1 flex-col"
        }
      >
        {children}
      </main>
      {isExperienceRoute ? null : (
        <footer className="border-t border-[var(--museum-rule)] py-6 text-center text-xs text-[var(--museum-muted)]">
          Quiet exhibition lighting · step carefully on the parquet
        </footer>
      )}
    </div>
  );
}
