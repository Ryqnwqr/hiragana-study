"use client";

import type { SyllabaryMode } from "@/lib/syllabary";

type SyllabarySwitchProps = {
  mode: SyllabaryMode;
  onChange: (mode: SyllabaryMode) => void;
  disabled?: boolean;
};

export function SyllabarySwitch({
  mode,
  onChange,
  disabled = false,
}: SyllabarySwitchProps) {
  return (
    <div
      className="syllabary-switch"
      role="tablist"
      aria-label="Study script"
    >
      <div
        className={`syllabary-switch-thumb ${mode === "katakana" ? "right" : ""}`}
        aria-hidden="true"
      />
      <button
        type="button"
        role="tab"
        className={`syllabary-switch-option ${mode === "hiragana" ? "active" : ""}`}
        aria-selected={mode === "hiragana"}
        disabled={disabled}
        onClick={() => onChange("hiragana")}
      >
        ひらがな
      </button>
      <button
        type="button"
        role="tab"
        className={`syllabary-switch-option ${mode === "katakana" ? "active" : ""}`}
        aria-selected={mode === "katakana"}
        disabled={disabled}
        onClick={() => onChange("katakana")}
      >
        カタカナ
      </button>
    </div>
  );
}
