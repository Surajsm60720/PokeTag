"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function LoginForm({ nextPath = "/" }: { nextPath?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Login failed.");
        setPending(false);
        return;
      }
      const dest =
        nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
      router.replace(dest);
      router.refresh();
    } catch {
      setError("Could not reach the vault.");
      setPending(false);
    }
  }

  return (
    <form className="login-gate__form" onSubmit={onSubmit}>
      <label className="login-gate__field">
        <span>Trainer ID</span>
        <input
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          disabled={pending}
        />
      </label>
      <label className="login-gate__field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={pending}
        />
      </label>
      {error ? (
        <p className="login-gate__error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Opening…" : "Enter vault"}
      </button>
    </form>
  );
}
