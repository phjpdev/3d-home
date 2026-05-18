import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex max-w-3xl flex-1 flex-col justify-center px-6 py-16">
      <p className="museum-sans text-xs font-semibold uppercase tracking-[0.28em] text-[var(--museum-muted)]">
        Bern · Einstein family era
      </p>
      <h1 className="museum-serif mt-4 text-4xl leading-tight text-[var(--museum-ink)] sm:text-5xl">
        A quiet house museum,
        <br />
        kept in light and numbers
      </h1>
      <p className="museum-sans mt-8 max-w-2xl text-base leading-relaxed text-[var(--museum-muted)]">
        Walk the boards as visitors do: pause at familiar furniture, tilt a frame toward
        the window-light, sketch a vase from ink and paper—or only from ink. Nothing is
        sold here; rooms only open differently.
      </p>
      <div className="mt-12 grid gap-4 border-t border-[var(--museum-rule)] pt-10 sm:grid-cols-3">
        <Link
          href="/generate"
          className="group flex flex-col rounded-sm border border-[var(--museum-rule)] bg-[var(--museum-parchment)] p-5 no-underline transition hover:border-[var(--museum-brass)]/55"
        >
          <span className="museum-serif text-lg text-[var(--museum-ink)] group-hover:text-[var(--museum-brass-dark)]">
            Generate model
          </span>
          <span className="museum-sans mt-2 text-sm text-[var(--museum-muted)]">
            Text or illustration to wrought mesh
          </span>
        </Link>
        <Link
          href="/edit"
          className="group flex flex-col rounded-sm border border-[var(--museum-rule)] bg-[var(--museum-parchment)] p-5 no-underline transition hover:border-[var(--museum-brass)]/55"
        >
          <span className="museum-serif text-lg text-[var(--museum-ink)] group-hover:text-[var(--museum-brass-dark)]">
            Edit home
          </span>
          <span className="museum-sans mt-2 text-sm text-[var(--museum-muted)]">
            Place pieces, hang paper on plaster
          </span>
        </Link>
        <Link
          href="/walk"
          className="group flex flex-col rounded-sm border border-[var(--museum-rule)] bg-[var(--museum-parchment)] p-5 no-underline transition hover:border-[var(--museum-brass)]/55"
        >
          <span className="museum-serif text-lg text-[var(--museum-ink)] group-hover:text-[var(--museum-brass-dark)]">
            Walk home
          </span>
          <span className="museum-sans mt-2 text-sm text-[var(--museum-muted)]">
            Only the floor—you may look about
          </span>
        </Link>
      </div>
    </div>
  );
}
