"use client";

import { useEffect, useRef } from "react";

type StudyCardProps = {
  cardKey: string;
  kana: string;
  group: string;
  romaji: string | null;
  isFlipped: boolean;
  isStartCard: boolean;
  isActive: boolean;
  recallTime: number;
  roundLabel: string;
  roundSize: number;
  onFlip: () => void;
  onAnswer: (correct: boolean) => void;
  onDismissStart: () => void;
};

const THROW = 100;
const TILT = 20;
const TIMER_MAX = 10000;
const SWIPE_ANIM_MS = 200;

export function StudyCard({
  cardKey,
  kana,
  group,
  romaji,
  isFlipped,
  isStartCard,
  isActive,
  recallTime,
  roundLabel,
  roundSize,
  onFlip,
  onAnswer,
  onDismissStart,
}: StudyCardProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const lblMissRef = useRef<HTMLDivElement>(null);
  const lblGotRef = useRef<HTMLDivElement>(null);
  const timerFillRef = useRef<HTMLDivElement>(null);
  const timerRafRef = useRef<number | null>(null);
  const cardShownAtRef = useRef(0);

  const onFlipRef = useRef(onFlip);
  const onAnswerRef = useRef(onAnswer);
  const onDismissStartRef = useRef(onDismissStart);
  const isFlippedRef = useRef(isFlipped);
  const isStartCardRef = useRef(isStartCard);
  onFlipRef.current = onFlip;
  onAnswerRef.current = onAnswer;
  onDismissStartRef.current = onDismissStart;
  isFlippedRef.current = isFlipped;
  isStartCardRef.current = isStartCard;

  useEffect(() => {
    const card = cardRef.current;
    const overlay = overlayRef.current;
    const lblM = lblMissRef.current;
    const lblG = lblGotRef.current;
    if (!card || !overlay || !lblM || !lblG) return;

    card.style.transform = "";
    card.style.transition = "";
    card.style.opacity = "1";
    overlay.style.opacity = "0";
    lblM.style.opacity = "0";
    lblG.style.opacity = "0";
  }, [cardKey]);

  useEffect(() => {
    if (!isActive || isStartCard || isFlipped) {
      if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current);
      if (timerFillRef.current) timerFillRef.current.style.width = "0%";
      return;
    }

    cardShownAtRef.current = Date.now();
    const fill = timerFillRef.current;
    if (!fill) return;

    fill.style.width = "0%";
    fill.style.background = "var(--green)";

    const tick = () => {
      const elapsed = Date.now() - cardShownAtRef.current;
      const pct = Math.min((elapsed / TIMER_MAX) * 100, 100);
      fill.style.width = `${pct}%`;
      if (elapsed < 2000) fill.style.background = "var(--green)";
      else if (elapsed < 5000) fill.style.background = "var(--gold)";
      else fill.style.background = "var(--red)";
      if (elapsed < TIMER_MAX) timerRafRef.current = requestAnimationFrame(tick);
    };

    timerRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current);
    };
  }, [cardKey, isStartCard, isFlipped, isActive]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const card = cardRef.current;
    const overlay = overlayRef.current;
    const lblM = lblMissRef.current;
    const lblG = lblGotRef.current;
    if (!wrap || !card || !overlay || !lblM || !lblG) return;

    let startX = 0;
    let startY = 0;
    let dx = 0;
    let dy = 0;
    let dragging = false;
    let didDrag = false;

    const resetCard = () => {
      card.style.transform = "";
      card.style.transition = "";
      card.style.opacity = "1";
      overlay.style.opacity = "0";
      lblM.style.opacity = "0";
      lblG.style.opacity = "0";
    };

    const onDown = (event: MouseEvent | TouchEvent) => {
      const pt = "touches" in event ? event.touches[0] : event;
      startX = pt.clientX;
      startY = pt.clientY;
      dx = 0;
      dy = 0;
      dragging = true;
      didDrag = false;
      card.style.transition = "none";
    };

    const onMove = (event: MouseEvent | TouchEvent) => {
      if (!dragging) return;
      const pt = "touches" in event ? event.touches[0] : event;
      dx = pt.clientX - startX;
      dy = pt.clientY - startY;
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      if (!isFlippedRef.current && !isStartCardRef.current) return;
      if (Math.abs(dy) > Math.abs(dx) * 1.5) return;
      didDrag = true;
      event.preventDefault();
      const rot = dx * (TILT / 300);
      card.style.transform = `translateX(${dx}px) rotate(${rot}deg)`;
      const ratio = Math.min(Math.abs(dx) / THROW, 1);
      if (isStartCardRef.current) {
        overlay.style.background = "rgba(224,107,139,0.18)";
        lblM.style.opacity = "0";
        lblG.style.opacity = "0";
      } else if (dx > 0) {
        overlay.style.background = "rgba(94,201,138,0.28)";
        lblG.style.opacity = String(ratio);
        lblM.style.opacity = "0";
      } else {
        overlay.style.background = "rgba(224,88,88,0.28)";
        lblM.style.opacity = String(ratio);
        lblG.style.opacity = "0";
      }
      overlay.style.opacity = String(ratio);
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;

      if (!didDrag) {
        if (isStartCardRef.current) {
          onDismissStartRef.current();
          card.style.transition = "";
          return;
        }
        if (!isFlippedRef.current) onFlipRef.current();
        card.style.transition = "";
        return;
      }

      if (!isFlippedRef.current && !isStartCardRef.current) {
        card.style.transition = "transform 0.25s ease";
        card.style.transform = "";
        return;
      }

      if (Math.abs(dx) >= THROW) {
        const dir = dx > 0 ? 1 : -1;
        card.style.transition = "transform 0.2s ease, opacity 0.2s ease";
        card.style.transform = `translateX(${dir * 460}px) rotate(${dir * 28}deg)`;
        card.style.opacity = "0";
        overlay.style.opacity = "0";
        lblM.style.opacity = "0";
        lblG.style.opacity = "0";

        window.setTimeout(() => {
          if (isStartCardRef.current) {
            resetCard();
            onDismissStartRef.current();
          } else {
            onAnswerRef.current(dir > 0);
          }
        }, SWIPE_ANIM_MS);
      } else {
        card.style.transition = "transform 0.32s cubic-bezier(0.34,1.56,0.64,1)";
        card.style.transform = "";
        overlay.style.opacity = "0";
        lblM.style.opacity = "0";
        lblG.style.opacity = "0";
        window.setTimeout(() => {
          card.style.transition = "";
        }, 320);
      }
      dx = 0;
    };

    wrap.addEventListener("mousedown", onDown);
    wrap.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);

    return () => {
      wrap.removeEventListener("mousedown", onDown);
      wrap.removeEventListener("touchstart", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  const badgeClass =
    recallTime < 2 ? "rb-fast" : recallTime < 5 ? "rb-mid" : "rb-slow";

  return (
    <>
      <div className="swipe-label left" ref={lblMissRef}>
        ✗ miss
      </div>
      <div className="swipe-label right" ref={lblGotRef}>
        ✓ got it
      </div>

      <div
        className="card-wrap"
        ref={wrapRef}
        role="button"
        tabIndex={0}
        aria-label={
          isStartCard
            ? `Start ${roundLabel} round, ${roundSize} card${roundSize !== 1 ? "s" : ""}`
            : isFlipped
              ? `${kana} revealed as ${romaji ?? "unknown"}, swipe right for got it, left for miss`
              : `Hiragana character, tap to reveal`
        }
      >
        <div className="card" ref={cardRef}>
          <div className="swipe-overlay" ref={overlayRef} />
          <div
            className={`card-face c-front ${isFlipped || isStartCard ? "gone" : ""}`}
          >
            <div className="timer-track">
              <div className="timer-fill" ref={timerFillRef} />
            </div>
            <span className="group-badge">{group}</span>
            <span className="kana-big">{kana}</span>
            <span className="tap-hint-text">tap to reveal</span>
          </div>
          <div className={`card-face c-back ${isFlipped ? "shown" : ""}`}>
            <span className={`reaction-badge ${badgeClass}`}>
              {recallTime.toFixed(1)}s
            </span>
            <span className="kana-small">{kana}</span>
            <span className="romaji-big">{romaji ?? "…"}</span>
            <div className="swipe-hint-back">
              <span className="sh-miss">← miss</span>
              <span className="sh-got">got it →</span>
            </div>
          </div>
          <div className={`card-face c-start ${isStartCard ? "shown" : ""}`}>
            <span className="cs-label">
              {roundLabel === "All" ? "All characters" : roundLabel}
            </span>
            <span className="cs-count">
              {roundSize} card{roundSize !== 1 ? "s" : ""}
            </span>
            <span className="cs-hint">swipe either way to begin</span>
          </div>
        </div>
      </div>
    </>
  );
}
