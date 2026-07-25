import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";

export const metadata: Metadata = {
  title: "AI-TimeTable — School schedules, solved overnight",
  description:
    "AI-TimeTable turns messy staff assignments into conflict-free school timetables. Preflight checks, background solving, teacher & parent views, and instant share links.",
};

// Applies the saved theme before paint to avoid a light/dark flash on load.
const noFlashScript = `
(function() {
  try {
    var t = localStorage.getItem('tt_theme');
    if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Work+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header className="no-print border-b border-border/70">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
            <Link href="/" className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-sm bg-ink text-cream font-display text-xl leading-none">
                tt
              </div>
              <span className="font-display text-2xl leading-none">AI-TimeTable</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/" className="hidden hover:text-foreground sm:inline">
                Dashboard
              </Link>
              <Link href="/rules" className="hidden hover:text-foreground sm:inline">
                Rules
              </Link>
              <Link href="/setup" className="hidden hover:text-foreground sm:inline">
                New School
              </Link>
              <ThemeToggle />
              <UserMenu />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
