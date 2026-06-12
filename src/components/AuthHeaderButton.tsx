"use client";

import type { User } from "@supabase/supabase-js";

type AuthHeaderButtonProps = {
  user: User | null;
  authChecked: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
};

export function AuthHeaderButton({
  user,
  authChecked,
  onSignIn,
  onSignOut,
}: AuthHeaderButtonProps) {
  if (!authChecked) {
    return (
      <div className="app-auth-bar" aria-hidden="true">
        <span className="auth-header-btn auth-header-btn--ghost" />
      </div>
    );
  }

  return (
    <div className="app-auth-bar">
      {user ? (
        <button type="button" className="auth-header-btn" onClick={onSignOut}>
          <span className="auth-header-label">
            {user.email?.split("@")[0] ?? "Account"}
          </span>
          <span className="auth-header-sep">·</span>
          <span className="auth-header-action">Sign out</span>
        </button>
      ) : (
        <button type="button" className="auth-header-btn" onClick={onSignIn}>
          <span className="auth-header-action">Log in</span>
          <span className="auth-header-sep">/</span>
          <span className="auth-header-action">Sign up</span>
        </button>
      )}
    </div>
  );
}
