"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export function AuthForm({ mode }: { mode: "sign-up" | "sign-in" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const signUp = mode === "sign-up";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/" + mode, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signUp ? { email, password, acceptPrivacy: accepted } : { email, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Please try again.");
      window.location.assign("/dashboard");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={submit}>
      <p className="eyebrow">Outreacher</p>
      <h1>{signUp ? "Join the first 20." : "Welcome back."}</h1>
      <p className="muted">
        {signUp
          ? "Create a private space to find professors and shape thoughtful first messages."
          : "Sign in to continue your outreach."}
      </p>
      <label>
        Email
        <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      <label>
        Password
        <input type="password" autoComplete={signUp ? "new-password" : "current-password"} minLength={signUp ? 12 : 1} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} required />
      </label>
      {signUp && (
        <label className="check-row">
          <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} required />
          <span>I agree to the <Link href="/privacy">Privacy Policy</Link>.</span>
        </label>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary" type="submit" disabled={busy}>
        {busy ? "Please wait" : signUp ? "Create account" : "Sign in"}
      </button>
      <p className="small-note">
        {signUp ? <>Already joined? <Link href="/sign-in">Sign in</Link>.</> : <>New here? <Link href="/sign-up">Create an account</Link>.</>}
      </p>
    </form>
  );
}
