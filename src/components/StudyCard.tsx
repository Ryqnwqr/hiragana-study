"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "motion/react";

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

// Drag distance (px) past which release commits an answer / dismiss.
const THROW = 100;
// Max card tilt (deg) at the edge of a drag.
const TILT = 20;
const TIMER_MAX = 10000;

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
  const timerFillRef = useRef<HTMLDivElement>(null);
  const timerRafRef = useRef<number | null>(null);
  const cardShownAtRef = useRef(0);
  // Guards the post-throw callback so a fling can't fire an answer twice.
  const throwingRef = useRef(false);
  // Drives the fade-out when a card is flung. A new card always remounts (unique
  // key in the parent) so this resets to false for every presentation.
  const [throwing, setThrowing] = useState(false);

  // Drag position drives every derived visual (tilt, overlays, labels) so the
  // gesture stays in sync without any imperative style writes — the stale-style
  // class of bug the old hand-rolled version was prone to simply can't happen.
  // Entrance (opacity/scale) is declarative via initial/animate so React
  // StrictMode's double-mount can't strand it mid-animation; only the throw —
  // fired from a gesture handler, never an effect — animates imperatively.
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-TILT, TILT]);

  const gotOverlay = useTransform(x, [0, THROW], [0, 0.28]);
  const missOverlay = useTransform(x, [-THROW, 0], [0.28, 0]);
  const startOverlay = useTransform(x, [-THROW, 0, THROW], [0.18, 0, 0.18]);
  const gotLabel = useTransform(x, [0, THROW], [0, 1]);
  const missLabel = useTransform(x, [-THROW, 0], [1, 0]);

  const canSwipe = isFlipped || isStartCard;
  // When the user prefers reduced motion, skip the entrance animation entirely:
  // initial={false} renders the card at its resting state synchronously, so it's
  // never stranded faded-out waiting on a frame.
  const reduceMotion = useReducedMotion();

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

  const handleTap = () => {
    if (throwingRef.current) return;
    if (isStartCard) {
      onDismissStart();
      return;
    }
    if (!isFlipped) onFlip();
  };

  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    if (throwingRef.current) return;
    const offset = info.offset.x;

    if (Math.abs(offset) >= THROW) {
      const dir = offset > 0 ? 1 : -1;
      throwingRef.current = true;
      setThrowing(true); // declaratively fades the card out as it flies off
      animate(x, dir * 520, {
        duration: 0.24,
        ease: "easeOut",
        onComplete: () => {
          if (isStartCard) onDismissStart();
          else onAnswer(dir > 0);
        },
      });
      return;
    }

    // Not far enough — spring back to center.
    animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
  };

  const badgeClass =
    recallTime < 2 ? "rb-fast" : recallTime < 5 ? "rb-mid" : "rb-slow";

  return (
    <div
      className="card-wrap"
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
      <motion.div
        className="card"
        style={{ x, rotate }}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
        animate={{ opacity: throwing ? 0 : 1, scale: 1 }}
        transition={{
          scale: { type: "spring", stiffness: 520, damping: 30 },
          opacity: { duration: 0.22, ease: "easeOut" },
        }}
        drag={canSwipe ? "x" : false}
        dragSnapToOrigin={false}
        dragElastic={0.6}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        onTap={handleTap}
      >
        {isStartCard ? (
          <motion.div
            className="swipe-overlay"
            style={{ opacity: startOverlay, background: "rgba(224,107,139,0.18)" }}
          />
        ) : (
          <>
            <motion.div
              className="swipe-overlay"
              style={{ opacity: gotOverlay, background: "rgba(94,201,138,1)" }}
            />
            <motion.div
              className="swipe-overlay"
              style={{ opacity: missOverlay, background: "rgba(224,88,88,1)" }}
            />
          </>
        )}

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
      </motion.div>

      <motion.div className="swipe-label left" style={{ opacity: missLabel }}>
        ✗ miss
      </motion.div>
      <motion.div className="swipe-label right" style={{ opacity: gotLabel }}>
        ✓ got it
      </motion.div>
    </div>
  );
}
