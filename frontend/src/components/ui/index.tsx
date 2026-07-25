import * as React from "react";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-sm border border-border/70 bg-paper p-6 shadow-[0_2px_12px_-4px_rgba(20,20,40,0.07)] ${className}`}
    >
      {children}
    </div>
  );
}

export function Button({
  children, className = "", variant = "primary", ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary:
      "bg-ink text-cream hover:opacity-90",
    ghost:
      "border border-ink/20 bg-transparent text-ink hover:border-ink/60",
    danger:
      "bg-destructive text-destructive-foreground hover:opacity-90",
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center rounded-sm px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full rounded-sm border border-border bg-paper px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-accent focus:ring-1 focus:ring-accent"
      {...props}
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
      {children}
    </label>
  );
}

export function Badge({ children, color = "slate" }: { children: React.ReactNode; color?: string }) {
  const map: Record<string, string> = {
    slate: "bg-muted text-muted-foreground",
    green: "bg-accent/20 text-accent-foreground",
    red: "bg-destructive/15 text-destructive",
    amber: "bg-accent/25 text-accent-foreground",
    indigo: "bg-accent/20 text-accent-foreground",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${map[color] || map.slate}`}>
      {children}
    </span>
  );
}
