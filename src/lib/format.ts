export function fmtSpeed(secs: number | null | undefined): string {
  return secs != null ? `${secs.toFixed(1)}s` : "—";
}

export function roundMessage(correct: number, total: number): string {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  if (pct >= 90) return `${pct}% — almost flawless.`;
  if (pct >= 70) return `${pct}% — solid. A few more rounds will lock these in.`;
  return `${pct}% — the tricky ones keep coming back until they stick.`;
}
