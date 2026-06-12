"use client";

import { useState } from "react";

import { setAuthSessionPolicy } from "@/lib/auth-session";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up";

type AuthPromptProps = {
  onDismiss: () => void;
  onSuccess: () => void | Promise<void>;
};

export function AuthPrompt({ onDismiss, onSuccess }: AuthPromptProps) {
  const [mode, setMode] = useState<AuthMode>("sign-up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    const supabase = createClient();
    const trimmedEmail = email.trim();

    const result =
      mode === "sign-up"
        ? await supabase.auth.signUp({
            email: trimmedEmail,
            password,
          })
        : await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          });

    setBusy(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (mode === "sign-up" && !result.data.session) {
      setError("Check your email to confirm your account, then sign in.");
      setMode("sign-in");
      return;
    }

    setAuthSessionPolicy(rememberMe);
    await onSuccess();
  };

  return (
    <div className="auth-overlay" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="auth-modal">
        <button
          type="button"
          className="auth-close"
          onClick={onDismiss}
          aria-label="Continue without account"
        >
          ✕
        </button>

        <AppMarkSmall />
        <h2 id="auth-title" className="auth-title">
          Save your progress
        </h2>
        <p className="auth-subtitle">
          Sign in to save progress across visits. Playing without an account
          resets every refresh.
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === "sign-up" ? "active" : ""}`}
            onClick={() => {
              setMode("sign-up");
              setError("");
            }}
          >
            Sign up
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === "sign-in" ? "active" : ""}`}
            onClick={() => {
              setMode("sign-in");
              setError("");
            }}
          >
            Sign in
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={
                mode === "sign-up" ? "new-password" : "current-password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>

          <label className="auth-remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span>Remember me</span>
          </label>

          {error ? <p className="auth-error">{error}</p> : null}

          <button type="submit" className="auth-submit" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "sign-up"
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <button type="button" className="auth-skip" onClick={onDismiss}>
          Continue without account
        </button>
      </div>
    </div>
  );
}

function AppMarkSmall() {
  return (
    <svg
      className="auth-mark"
      width={40}
      height={40}
      viewBox="0 0 180 180"
      aria-hidden="true"
    >
      <rect width="180" height="180" rx="40" fill="#0c0e14" />
      <rect
        x="8"
        y="8"
        width="164"
        height="164"
        rx="34"
        fill="none"
        stroke="#e06b8b"
        strokeWidth="2"
        opacity="0.35"
      />
      <text
        x="90"
        y="122"
        textAnchor="middle"
        fontFamily="var(--font-noto-sans-jp), 'Noto Sans JP', sans-serif"
        fontSize="92"
        fontWeight="300"
        fill="#e06b8b"
      >
        あ
      </text>
    </svg>
  );
}
