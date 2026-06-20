import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Timetable AI",
  description: "AI-powered conflict-free timetable generator for schools",
};

// Applies the saved theme before paint to avoid a light/dark flash on load.
const noFlashScript = `
(function() {
  try {
    var t = localStorage.getItem('theme');
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
      </head>
      <body>
        <header className="no-print border-b bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
                TT
              </span>
              <span>Timetable AI</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
              <Link href="/" className="hover:text-brand-600">Dashboard</Link>
              <Link href="/rules" className="hover:text-brand-600">Rules</Link>
              <Link href="/setup" className="hover:text-brand-600">New School</Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
