"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, setToken } from "@/lib/api";
import { Card, Button, Input, Label } from "@/components/ui";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res =
        mode === "login"
          ? await api.login({ email, password })
          : await api.register({ email, name, password });
      setToken(res.access_token);
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError) {
        // Pydantic validation errors arrive as a list of {msg} objects.
        const d = err.detail;
        setError(
          Array.isArray(d)
            ? d.map((x) => (x as { msg?: string }).msg ?? String(x)).join(" · ")
            : String(err.message)
        );
      } else {
        setError("Could not reach the server. It may be waking up — try again in a minute.");
      }
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm items-center">
      <div className="w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-sm bg-ink text-cream font-display text-3xl leading-none">
            tt
          </div>
          <h1 className="font-display text-4xl">
            {mode === "login" ? "Sign in" : "Create account"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "login"
              ? "Manage your school's timetables."
              : "One account per institution admin — free to start."}
          </p>
        </div>

        <Card>
          <form onSubmit={submit} className="space-y-5">
            {mode === "register" && (
              <div>
                <Label>Your name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="A. Sharma" required />
              </div>
            )}
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@school.edu" required autoComplete="email" />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "register" ? "At least 8 characters" : "••••••••"}
                required minLength={mode === "register" ? 8 : undefined}
                autoComplete={mode === "register" ? "new-password" : "current-password"} />
            </div>

            {error && (
              <div className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              New here?{" "}
              <button className="font-medium text-accent hover:underline" onClick={() => { setMode("register"); setError(null); }}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button className="font-medium text-accent hover:underline" onClick={() => { setMode("login"); setError(null); }}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
