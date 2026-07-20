import Link from "next/link";

export default function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-ink/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-spotlight text-xs font-bold text-ink">
            IV
          </span>
          <span className="font-display text-[15px] font-semibold tracking-tight text-paper">
            InterView<span className="text-spotlight">AI</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 font-body text-sm text-graphite md:flex">
          <Link href="/#modules" className="transition-colors hover:text-paper">
            Assessment
          </Link>
          <Link href="/#pipeline" className="transition-colors hover:text-paper">
            How it works
          </Link>
          <Link href="/#audience" className="transition-colors hover:text-paper">
            Who it&apos;s for
          </Link>
        </nav>

        <Link
          href="/session"
          className="rounded-sm bg-spotlight px-4 py-2 font-body text-sm font-medium text-ink transition-transform hover:scale-[1.03]"
        >
          Start mock interview
        </Link>
      </div>
    </header>
  );
}
