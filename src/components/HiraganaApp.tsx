"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StudyCard } from "@/components/StudyCard";
import {
  fetchGroups,
  fetchProgress,
  resetProgress,
  revealCard,
  shuffleRound,
  startRound,
  submitAnswer,
  type ProgressResponse,
  type PublicCard,
  type RoundSnapshot,
} from "@/lib/client-api";
import { launchConfetti } from "@/lib/confetti";
import { fmtSpeed, roundMessage } from "@/lib/format";

type Screen = "welcome" | "study" | "stats";
type DotMap = Record<string, "unseen" | "seen" | "good" | "mid" | "bad">;

export function HiraganaApp() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [showNav, setShowNav] = useState(false);
  const [groups, setGroups] = useState<string[]>([]);
  const [activeGroup, setActiveGroup] = useState("All");
  const [snapshot, setSnapshot] = useState<RoundSnapshot | null>(null);
  const [localDeck, setLocalDeck] = useState<PublicCard[]>([]);
  const [dotMap, setDotMap] = useState<DotMap>({});
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [romaji, setRomaji] = useState<string | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isStartCard, setIsStartCard] = useState(false);
  const [recallTime, setRecallTime] = useState(0);
  const [roundLoading, setRoundLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [flash, setFlash] = useState<"" | "good" | "bad">("");
  const [showBanner, setShowBanner] = useState(false);

  const cardShownAtRef = useRef(0);
  const confettiRef = useRef<HTMLCanvasElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const answerQueueRef = useRef(Promise.resolve());
  const pendingAnswerRef = useRef<string | null>(null);
  const serverDeckRef = useRef<PublicCard[]>([]);
  const revealRequestRef = useRef(0);

  const loadProgress = useCallback(async () => {
    const data = await fetchProgress();
    setProgress(data);
    return data;
  }, []);

  const applyRoundData = useCallback(
    (
      nextSnapshot: RoundSnapshot,
      nextDots: DotMap,
      deck: PublicCard[],
      awaitingStart = false,
    ) => {
      setSnapshot(nextSnapshot);
      setDotMap(nextDots);
      setLocalDeck(deck);
      setIsStartCard(awaitingStart);
      setIsFlipped(false);
      setRomaji(null);
      setRecallTime(0);
      pendingAnswerRef.current = null;
      serverDeckRef.current = deck;
      answerQueueRef.current = Promise.resolve();
      revealRequestRef.current += 1;
    },
    [],
  );

  useEffect(() => {
    void (async () => {
      const [{ groups: groupNames }, progressData] = await Promise.all([
        fetchGroups(),
        loadProgress(),
      ]);
      setGroups(groupNames);
      setProgress(progressData);
    })();

    const standalone =
      // @ts-expect-error legacy iOS standalone flag
      window.navigator.standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;

    if (!standalone && !sessionStorage.getItem("banner_dismissed")) {
      const timer = window.setTimeout(() => setShowBanner(true), 2500);
      return () => window.clearTimeout(timer);
    }
  }, [loadProgress]);

  useEffect(() => {
    if (!snapshot?.currentCard || isStartCard || isFlipped) return;
    cardShownAtRef.current = Date.now();
  }, [snapshot?.currentCard?.k, isStartCard, isFlipped, snapshot]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 2200);
  }, []);

  const flashFeedback = useCallback((ok: boolean) => {
    setFlash(ok ? "good" : "bad");
    window.setTimeout(() => setFlash(""), 400);
  }, []);

  const runRound = useCallback(
    async (group: string) => {
      setRoundLoading(true);
      try {
        const data = await startRound(group);
        applyRoundData(data, data.dotMap, data.deck, true);
      } finally {
        setRoundLoading(false);
      }
    },
    [applyRoundData],
  );

  const dismissStartCard = useCallback(() => {
    setIsStartCard(false);
  }, []);

  const handleFlip = useCallback(() => {
    if (!snapshot?.currentCard || isFlipped || isStartCard) return;

    const elapsed = Math.min((Date.now() - cardShownAtRef.current) / 1000, 60);
    const requestId = revealRequestRef.current + 1;
    revealRequestRef.current = requestId;

    setRecallTime(elapsed);
    setIsFlipped(true);
    setRomaji(null);

    void (async () => {
      try {
        await answerQueueRef.current;

        if (revealRequestRef.current !== requestId) return;

        const result = await revealCard();
        if (revealRequestRef.current !== requestId) return;

        setRomaji(result.romaji);
        setSnapshot(result.snapshot);
        setDotMap(result.dotMap);
        serverDeckRef.current = result.snapshot.currentCard
          ? [
              result.snapshot.currentCard,
              ...serverDeckRef.current.slice(1),
            ]
          : serverDeckRef.current;
      } catch {
        if (revealRequestRef.current !== requestId) return;
        setIsFlipped(false);
        showToast("Could not reveal card");
      }
    })();
  }, [isFlipped, isStartCard, showToast, snapshot?.currentCard]);

  const handleAnswer = useCallback(
    (correct: boolean) => {
      if (!snapshot?.currentCard || !isFlipped) return;

      const kana = snapshot.currentCard.k;
      if (pendingAnswerRef.current === kana) return;
      pendingAnswerRef.current = kana;

      const answeredRecall = recallTime;

      flashFeedback(correct);
      revealRequestRef.current += 1;
      setIsFlipped(false);
      setRomaji(null);

      answerQueueRef.current = answerQueueRef.current
        .then(async () => {
          const result = await submitAnswer(kana, correct, answeredRecall);
          setSnapshot(result.snapshot);
          setDotMap(result.dotMap);
          setLocalDeck(result.deck);
          serverDeckRef.current = result.deck;

          if (result.confetti) launchConfetti(confettiRef.current);
          void loadProgress();
        })
        .catch(() => {
          showToast("Could not save answer — refreshing round");
          void runRound(activeGroup);
        })
        .finally(() => {
          if (pendingAnswerRef.current === kana) {
            pendingAnswerRef.current = null;
          }
        });
    },
    [
      activeGroup,
      flashFeedback,
      isFlipped,
      loadProgress,
      recallTime,
      runRound,
      showToast,
      snapshot,
    ],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (screen !== "study" || roundLoading) return;

      if (event.code === "Space" || event.code === "Enter") {
        event.preventDefault();
        if (isStartCard) dismissStartCard();
        else if (!isFlipped) handleFlip();
      }
      if (event.code === "ArrowRight" || event.code === "KeyL") {
        if (isStartCard) dismissStartCard();
        else if (isFlipped) handleAnswer(true);
      }
      if (event.code === "ArrowLeft" || event.code === "KeyH") {
        if (isStartCard) dismissStartCard();
        else if (isFlipped) handleAnswer(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    dismissStartCard,
    handleAnswer,
    handleFlip,
    isFlipped,
    isStartCard,
    roundLoading,
    screen,
  ]);

  const goScreen = async (next: Screen) => {
    setScreen(next);
    if (next === "stats") {
      await loadProgress();
    }
  };

  const handleStartStudy = async () => {
    setShowNav(true);
    setScreen("study");
    await runRound(activeGroup);
  };

  const handleShuffle = async () => {
    if (roundLoading) return;
    setRoundLoading(true);
    try {
      const result = await shuffleRound();
      applyRoundData(result.snapshot, result.dotMap, result.deck, false);
      showToast("Deck shuffled");
    } catch {
      await runRound(activeGroup);
    } finally {
      setRoundLoading(false);
    }
  };

  const handleGroupChange = async (group: string) => {
    setActiveGroup(group);
    await runRound(group);
  };

  const handleReset = async () => {
    if (!confirm("Reset all progress? This cannot be undone.")) return;
    await resetProgress();
    await loadProgress();
    setSnapshot(null);
    setLocalDeck([]);
    setDotMap({});
    showToast("Progress reset");
  };

  const roundComplete =
    snapshot != null &&
    !isStartCard &&
    snapshot.roundComplete &&
    snapshot.sessionTotal > 0;

  const progressPct =
    snapshot && snapshot.roundSize > 0
      ? Math.max(0, (snapshot.sessionTotal / snapshot.roundSize) * 100)
      : 0;

  const dotEntries = Object.entries(dotMap);
  const displayCard = snapshot?.currentCard;

  return (
    <>
      <div id="flash" className={flash ? `f-${flash}` : ""} />
      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
      <canvas id="confetti" ref={confettiRef} />

      {showBanner && (
        <div className="install-banner">
          <button
            className="close-banner"
            onClick={() => {
              setShowBanner(false);
              sessionStorage.setItem("banner_dismissed", "1");
            }}
          >
            ✕
          </button>
          <p>
            📲 <strong>Install as an app:</strong> tap the <strong>Share</strong>{" "}
            button in Safari, then <strong>&quot;Add to Home Screen&quot;</strong>{" "}
            for a fullscreen experience.
          </p>
        </div>
      )}

      <div className={`screen welcome-screen ${screen === "welcome" ? "active" : ""}`}>
        <div className="welcome-inner">
          <div className="welcome-logo">ひらがな</div>
          <div className="welcome-chars">あいうえお</div>
          <div className="welcome-tagline">
            Master hiragana with spaced repetition.
            <br />
            Reaction time shapes your mastery score.
          </div>
          <div className="welcome-how">
            <div className="wh-row">
              <span className="wh-color" style={{ color: "var(--green)" }}>
                Fast recall
              </span>{" "}
              earns more mastery per card
            </div>
            <div className="wh-row">
              <span className="wh-color" style={{ color: "var(--gold)" }}>
                Slow recall
              </span>{" "}
              earns less — cards stay in rotation longer
            </div>
            <div className="wh-row">
              <span className="wh-color" style={{ color: "var(--red)" }}>
                Wrong answers
              </span>{" "}
              always lose 2 points and repeat soon
            </div>
          </div>

          {progress?.welcome.hasProgress && (
            <div className="welcome-return">
              <div className="wr-item">
                <div className="wr-val" style={{ color: "var(--sakura)" }}>
                  {progress.welcome.mastered}
                </div>
                <div className="wr-lbl">Mastered</div>
              </div>
              <div className="wr-item">
                <div className="wr-val" style={{ color: "var(--green)" }}>
                  {progress.welcome.accuracy}%
                </div>
                <div className="wr-lbl">Accuracy</div>
              </div>
              <div className="wr-item">
                <div className="wr-val" style={{ color: "var(--gold)" }}>
                  {progress.welcome.bestStreak}
                </div>
                <div className="wr-lbl">Best streak</div>
              </div>
              <div className="wr-item">
                <div className="wr-val" style={{ color: "var(--sub)" }}>
                  {fmtSpeed(progress.welcome.avgRecall)}
                </div>
                <div className="wr-lbl">Avg recall</div>
              </div>
            </div>
          )}

          <button className="welcome-start-btn" onClick={() => void handleStartStudy()}>
            Begin studying →
          </button>
        </div>
      </div>

      <div className={`screen study-screen ${screen === "study" ? "active" : ""}`}>
        <div className="study-header">
          <div className="logo">ひらがな</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn-icon"
              title="Shuffle"
              onClick={() => void handleShuffle()}
              disabled={roundLoading}
            >
              ⇄
            </button>
          </div>
        </div>

        <div className="group-scroll">
          <div className="group-row">
            {groups.map((name) => (
              <button
                key={name}
                className={`gtab ${name === activeGroup ? "active" : ""}`}
                onClick={() => void handleGroupChange(name)}
                disabled={roundLoading}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-chip">
            <div className="sv" style={{ color: "var(--sakura)" }}>
              {snapshot?.sessionStreak ?? 0}
            </div>
            <div className="sl">Streak</div>
          </div>
          <div className="stat-chip">
            <div className="sv" style={{ color: "var(--green)" }}>
              {snapshot?.sessionCorrect ?? 0}
            </div>
            <div className="sl">Correct</div>
          </div>
          <div className="stat-chip">
            <div className="sv" style={{ color: "var(--sub)" }}>
              {fmtSpeed(snapshot?.avgRecall)}
            </div>
            <div className="sl">Avg speed</div>
          </div>
          <div className="stat-chip">
            <div className="sv" style={{ color: "var(--gold)" }}>
              {snapshot?.masteredCount ?? progress?.masteredCount ?? 0}
            </div>
            <div className="sl">Mastered</div>
          </div>
        </div>

        <div className="arena">
          {!roundComplete && displayCard && (
            <StudyCard
              key={isStartCard ? "start" : displayCard.k}
              cardKey={isStartCard ? "start" : displayCard.k}
              kana={isStartCard ? "あ" : displayCard.k}
              group={displayCard.group}
              romaji={romaji}
              isFlipped={isFlipped}
              isStartCard={isStartCard}
              recallTime={recallTime}
              roundLabel={snapshot?.group ?? activeGroup}
              roundSize={snapshot?.roundSize ?? localDeck.length}
              onFlip={handleFlip}
              onAnswer={handleAnswer}
              onDismissStart={dismissStartCard}
            />
          )}

          {!roundComplete && (
            <>
              <div className="prog-bar-wrap">
                <div
                  className="prog-bar-fill"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="dots-row">
                {dotEntries.map(([key, status]) => (
                  <div
                    key={key}
                    className={`dot ${
                      status === "good"
                        ? "d-good"
                        : status === "mid"
                          ? "d-mid"
                          : status === "bad"
                            ? "d-bad"
                            : status === "seen"
                              ? "d-seen"
                              : ""
                    }`}
                    title={key}
                  />
                ))}
              </div>
            </>
          )}

          {roundComplete && snapshot && (
            <div className="round-end show">
              <div className="round-kana">よし！</div>
              <div className="round-title">Round done</div>
              <div className="round-msg">
                {roundMessage(snapshot.sessionCorrect, snapshot.sessionTotal)}
              </div>
              <div className="round-speed">
                {snapshot.avgRecall != null
                  ? `Avg recall time this round: ${snapshot.avgRecall.toFixed(1)}s`
                  : ""}
              </div>
              <button
                className="round-again"
                onClick={() => void runRound(activeGroup)}
              >
                Next round →
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={`screen stats-screen ${screen === "stats" ? "active" : ""}`}>
        <div className="stats-screen-header">
          <h2>Your progress</h2>
        </div>
        <div className="summary-grid">
          <div className="sum-card">
            <div className="sv" style={{ color: "var(--sakura)" }}>
              {progress?.totalAnswers ?? 0}
            </div>
            <div className="sl">Total answers</div>
          </div>
          <div className="sum-card">
            <div className="sv" style={{ color: "var(--green)" }}>
              {progress?.accuracy != null ? `${progress.accuracy}%` : "—"}
            </div>
            <div className="sl">All-time acc.</div>
          </div>
          <div className="sum-card">
            <div className="sv" style={{ color: "var(--gold)" }}>
              {progress?.bestStreak ?? 0}
            </div>
            <div className="sl">Best streak</div>
          </div>
          <div className="sum-card">
            <div className="sv" style={{ color: "var(--sub)" }}>
              {fmtSpeed(progress?.avgRecall)}
            </div>
            <div className="sl">Avg recall</div>
          </div>
        </div>
        <div className="section-label">Character mastery &amp; speed</div>
        <div className="speed-legend">
          <div className="sl-item">
            <div className="sl-dot" style={{ background: "var(--green)" }} />
            &lt;2s fast
          </div>
          <div className="sl-item">
            <div className="sl-dot" style={{ background: "var(--gold)" }} />
            2–5s learning
          </div>
          <div className="sl-item">
            <div className="sl-dot" style={{ background: "var(--red)" }} />
            &gt;5s needs work
          </div>
        </div>
        <div className="mastery-grid">
          {progress?.mastery.map((cell) => {
            const timeClass =
              cell.avgTime == null
                ? "t-none"
                : cell.avgTime < 2
                  ? "t-fast"
                  : cell.avgTime < 5
                    ? "t-mid"
                    : "t-slow";
            return (
              <div key={cell.k} className="mg-cell" data-lvl={cell.level}>
                <div className="mg-kana">{cell.k}</div>
                <div className="mg-romaji">{cell.r}</div>
                <div className={`mg-time ${timeClass}`}>
                  {cell.avgTime != null ? `${cell.avgTime.toFixed(1)}s` : "·"}
                </div>
                <div className="mg-bar" />
              </div>
            );
          })}
        </div>
        <button className="reset-btn" onClick={() => void handleReset()}>
          Reset all progress
        </button>
      </div>

      {showNav && (
        <div className="bottom-nav">
          <button
            className={`nav-btn ${screen === "study" ? "active" : ""}`}
            onClick={() => void goScreen("study")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            Study
          </button>
          <button
            className={`nav-btn ${screen === "stats" ? "active" : ""}`}
            onClick={() => void goScreen("stats")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 3v18h18" />
              <path d="M7 16l4-6 4 4 4-6" />
            </svg>
            Progress
          </button>
        </div>
      )}
    </>
  );
}
