"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // Close the account menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!authChecked) {
    return (
      <div className="app-auth-bar" aria-hidden="true">
        <span className="auth-header-btn auth-header-btn--ghost" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-auth-bar">
        <button
          type="button"
          className="auth-header-btn auth-header-btn--signin"
          onClick={onSignIn}
        >
          <LoginIcon />
          <span>Sign in</span>
        </button>
      </div>
    );
  }

  const name = user.email?.split("@")[0] ?? "Account";
  const initial = name.charAt(0).toUpperCase() || "?";

  return (
    <div className="app-auth-bar" ref={barRef}>
      <button
        type="button"
        className="auth-header-btn auth-header-btn--account"
        onClick={() => setMenuOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <span className="auth-avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="auth-header-label">{name}</span>
        <ChevronIcon open={menuOpen} />
      </button>

      {menuOpen && (
        <div className="auth-menu" role="menu">
          <div className="auth-menu-email">{user.email}</div>
          <button
            type="button"
            className="auth-menu-item"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onSignOut();
            }}
          >
            <LogoutIcon />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}

function LoginIcon() {
  return (
    <svg
      className="auth-icon"
      viewBox="0 0 24 24"
      width={15}
      height={15}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={15}
      height={15}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`auth-chevron ${open ? "open" : ""}`}
      viewBox="0 0 12 7"
      width={10}
      height={6}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1 1l5 5 5-5"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
