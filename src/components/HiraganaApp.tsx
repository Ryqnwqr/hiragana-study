"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthHeaderButton } from "@/components/AuthHeaderButton";
import { AuthPrompt } from "@/components/AuthPrompt";
import { StudyCard } from "@/components/StudyCard";
import {
  clearGuestSession,
  fetchGroups,
  fetchProgress,
  resetProgress,
  revealCard,
  startRound,
  submitAnswer,
  syncAuthProgress,
  type ProgressResponse,
  type PublicCard,
  type RoundSnapshot,
} from "@/lib/client-api";
import {
  clearAuthSessionPolicy,
  enforceAuthSessionPolicy,
} from "@/lib/auth-session";
import { AppMark } from "@/components/AppMark";
import { createClient } from "@/lib/supabase/client";
import { launchConfetti } from "@/lib/confetti";
import { fmtSpeed, roundMessage } from "@/lib/format";
import { lookupRomaji } from "@/lib/romaji-lookup";
import { isPhoneDevice } from "@/lib/device";
import { advancePublicDeck } from "@/lib/deck-advance";
import {
  MASTERY_SORT_OPTIONS,
  sortMasteryCells,
  type MasterySort,
} from "@/lib/mastery-sort";

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
  const [toast, setToast] = useState("");
  const [flash, setFlash] = useState<"" | "good" | "bad">("");
  const [showBanner, setShowBanner] = useState(false);
  const [masterySort, setMasterySort] = useState<MasterySort>("deck");
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  const sortedMastery = useMemo(
    () => sortMasteryCells(progress?.mastery ?? [], masterySort),
    [masterySort, progress?.mastery],
  );

  const cardShownAtRef = useRef(0);
  const confettiRef = useRef<HTMLCanvasElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const answerQueueRef = useRef(Promise.resolve());
  const inFlightAnswersRef = useRef(new Set<string>());
  const activeRoundIdRef = useRef<string | null>(null);
  const localDeckRef = useRef<PublicCard[]>([]);
  const revealRequestRef = useRef(0);
  const authPromptDismissedRef = useRef(false);
  const authFromStartCardRef = useRef(false);
  const roundBusyRef = useRef(false);

  const loadProgress = useCallback(async () => {
    const data = await fetchProgress();
    setProgress(data);
    return data;
  }, []);

  const refreshProgress = useCallback(() => {
    void loadProgress().catch(() => {
      // Stats can refresh again later without blocking play.
    });
  }, [loadProgress]);

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
      inFlightAnswersRef.current.clear();
      activeRoundIdRef.current = nextSnapshot.roundId;
      localDeckRef.current = deck;
      answerQueueRef.current = Promise.resolve();
      revealRequestRef.current += 1;
    },
    [],
  );

  const drainRoundSync = useCallback(async () => {
    revealRequestRef.current += 1;
    await answerQueueRef.current.catch(() => {});
    answerQueueRef.current = Promise.resolve();
    inFlightAnswersRef.current.clear();
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let bannerTimer: number | undefined;

    void (async () => {
      const {
        data: { user: initialUser },
      } = await supabase.auth.getUser();

      const expired = initialUser
        ? await enforceAuthSessionPolicy(supabase)
        : false;

      const activeUser = expired ? null : initialUser;
      setUser(activeUser);
      setAuthChecked(true);

      void fetchGroups()
        .then(({ groups: groupNames }) => setGroups(groupNames))
        .catch(() => setGroups([]));

      const refreshAfterGuestClear = () => {
        void loadProgress()
          .then((progressData) => setProgress(progressData))
          .catch(() => setProgress(null));
      };

      if (!activeUser) {
        void clearGuestSession().then(refreshAfterGuestClear);
      } else {
        refreshAfterGuestClear();
      }

      const standalone =
        // @ts-expect-error legacy iOS standalone flag
        window.navigator.standalone === true ||
        window.matchMedia("(display-mode: standalone)").matches;

      if (
        isPhoneDevice() &&
        !standalone &&
        !sessionStorage.getItem("banner_dismissed")
      ) {
        bannerTimer = window.setTimeout(() => setShowBanner(true), 2500);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    const handleFocus = () => {
      void enforceAuthSessionPolicy(supabase).then((didExpire) => {
        if (didExpire) setUser(null);
      });
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("focus", handleFocus);
      if (bannerTimer) window.clearTimeout(bannerTimer);
    };
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
      if (roundBusyRef.current) return;
      roundBusyRef.current = true;
      try {
        await drainRoundSync();
        const data = await startRound(group);
        applyRoundData(data, data.dotMap, data.deck, true);
      } catch {
        showToast("Could not start round");
        inFlightAnswersRef.current.clear();
      } finally {
        roundBusyRef.current = false;
      }
    },
    [applyRoundData, drainRoundSync, showToast],
  );

  const openAuthPrompt = useCallback((fromStartCard = false) => {
    authFromStartCardRef.current = fromStartCard;
    setShowAuthPrompt(true);
  }, []);

  const dismissAuthPrompt = useCallback(() => {
    if (authFromStartCardRef.current) {
      authPromptDismissedRef.current = true;
      setIsStartCard(false);
    }
    authFromStartCardRef.current = false;
    setShowAuthPrompt(false);
  }, []);

  const handleAuthSuccess = useCallback(async () => {
    const fromStartCard = authFromStartCardRef.current;
    authFromStartCardRef.current = false;
    setShowAuthPrompt(false);
    if (fromStartCard) setIsStartCard(false);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      showToast("Signed in, but sync failed");
      return;
    }

    setUser(session.user);

    void syncAuthProgress({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
      .then(() => loadProgress())
      .then(() => showToast("Progress synced"))
      .catch(() => showToast("Signed in, but sync failed"));
  }, [loadProgress, showToast]);

  const dismissStartCard = useCallback(() => {
    if (!authChecked) return;

    if (user || authPromptDismissedRef.current) {
      setIsStartCard(false);
      return;
    }
    openAuthPrompt(true);
  }, [authChecked, openAuthPrompt, user]);

  const handleSignOut = useCallback(() => {
    const supabase = createClient();
    clearAuthSessionPolicy();
    activeRoundIdRef.current = null;
    setUser(null);
    setSnapshot(null);
    setLocalDeck([]);
    setDotMap({});
    setScreen("welcome");
    setShowNav(false);
    showToast("Signed out");

    void (async () => {
      await drainRoundSync();
      await supabase.auth.signOut();
      await clearGuestSession();
      refreshProgress();
    })();
  }, [drainRoundSync, refreshProgress, showToast]);

  const handleFlip = useCallback(() => {
    if (!snapshot?.currentCard || isFlipped || isStartCard) return;

    const kana = snapshot.currentCard.k;
    const localRomaji = lookupRomaji(kana);
    if (!localRomaji) {
      showToast("Unknown character");
      return;
    }

    const elapsed = Math.min((Date.now() - cardShownAtRef.current) / 1000, 60);
    const roundId = snapshot.roundId;
    const requestId = revealRequestRef.current + 1;
    revealRequestRef.current = requestId;

    setRecallTime(elapsed);
    setRomaji(localRomaji);
    setIsFlipped(true);
    setDotMap((prev) => ({
      ...prev,
      [kana]: prev[kana] === "unseen" ? "seen" : prev[kana],
    }));

    // Serialize reveal with answers so session writes never race on the server.
    answerQueueRef.current = answerQueueRef.current
      .then(() => revealCard())
      .then((result) => {
        if (revealRequestRef.current !== requestId) return;
        if (activeRoundIdRef.current !== roundId) return;
        setDotMap(result.dotMap);
        setSnapshot((prev) =>
          prev
            ? {
                ...prev,
                ...result.snapshot,
                currentCard: prev.currentCard,
              }
            : result.snapshot,
        );
      })
      .catch(() => {
        // Local romaji is already shown; answer API will auto-reveal if needed.
      });
  }, [isFlipped, isStartCard, showToast, snapshot]);

  const handleAnswer = useCallback(
    (correct: boolean) => {
      if (!snapshot?.currentCard || !isFlipped) return;

      const kana = snapshot.currentCard.k;
      if (inFlightAnswersRef.current.has(kana)) return;
      inFlightAnswersRef.current.add(kana);

      const answeredRecall = recallTime;
      const roundId = snapshot.roundId;

      flashFeedback(correct);
      revealRequestRef.current += 1;

      const deck = advancePublicDeck(localDeckRef.current, kana, correct);
      localDeckRef.current = deck;
      const nextCard = deck[0] ?? null;
      const sessionTotal = snapshot.sessionTotal + 1;
      const sessionCorrect = snapshot.sessionCorrect + (correct ? 1 : 0);
      const sessionStreak = correct ? snapshot.sessionStreak + 1 : 0;
      const sessionRecallTotal =
        snapshot.sessionTotal > 0 && snapshot.avgRecall != null
          ? snapshot.avgRecall * snapshot.sessionTotal + answeredRecall
          : answeredRecall;

      setLocalDeck(deck);
      setSnapshot({
        ...snapshot,
        currentCard: nextCard,
        remaining: deck.length,
        sessionTotal,
        sessionCorrect,
        sessionStreak,
        avgRecall: sessionRecallTotal / sessionTotal,
        roundComplete: deck.length === 0 && sessionTotal > 0,
        revealed: false,
      });
      setDotMap((prev) => ({
        ...prev,
        [kana]: correct ? "mid" : "bad",
      }));
      setIsFlipped(false);
      setRomaji(null);
      setRecallTime(0);

      const applyAnswerResult = (
        result: Awaited<ReturnType<typeof submitAnswer>>,
      ) => {
        if (activeRoundIdRef.current !== roundId) {
          inFlightAnswersRef.current.delete(kana);
          return;
        }
        setSnapshot(result.snapshot);
        setDotMap(result.dotMap);
        setLocalDeck(result.deck);
        localDeckRef.current = result.deck;
        if (result.confetti) launchConfetti(confettiRef.current);
        refreshProgress();
        inFlightAnswersRef.current.delete(kana);
      };

      const saveAnswer = async () => {
        try {
          return await submitAnswer(kana, correct, answeredRecall);
        } catch {
          await revealCard().catch(() => {});
          return await submitAnswer(kana, correct, answeredRecall);
        }
      };

      answerQueueRef.current = answerQueueRef.current
        .then(async () => {
          const result = await saveAnswer();
          applyAnswerResult(result);
        })
        .catch(async () => {
          inFlightAnswersRef.current.delete(kana);
          showToast("Could not save answer — refreshing round");
          await runRound(activeGroup);
        });
    },
    [
      activeGroup,
      flashFeedback,
      isFlipped,
      recallTime,
      refreshProgress,
      runRound,
      showToast,
      snapshot,
    ],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (screen !== "study") return;

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
    screen,
  ]);

  const goScreen = (next: Screen) => {
    setScreen(next);
    if (next === "stats") refreshProgress();
  };

  const handleStartStudy = () => {
    setShowNav(true);
    setScreen("study");
    void runRound(activeGroup);
  };

  const handleGroupChange = (group: string) => {
    if (group === activeGroup) return;
    setActiveGroup(group);
    void runRound(group);
  };

  const handleReset = async () => {
    if (!confirm("Reset all progress? This cannot be undone.")) return;

    try {
      // Let in-flight reveal/answer syncs finish so they don't undo the reset.
      await drainRoundSync();
      activeRoundIdRef.current = null;

      const data = await resetProgress();
      setProgress(data);
      setSnapshot(null);
      setLocalDeck([]);
      setDotMap({});
      showToast("Progress reset");
    } catch {
      showToast("Could not reset progress");
    }
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

      <AuthHeaderButton
        user={user}
        authChecked={authChecked}
        onSignIn={() => openAuthPrompt(false)}
        onSignOut={() => void handleSignOut()}
      />

      {showAuthPrompt && (
        <AuthPrompt onDismiss={dismissAuthPrompt} onSuccess={handleAuthSuccess} />
      )}

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
          <AppMark size={72} />
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
          <div className="logo">
            <AppMark size={32} />
            <span>ひらがな</span>
          </div>
        </div>

        <div className="group-scroll">
          <div className="group-row">
            {groups.map((name) => (
              <button
                key={name}
                type="button"
                className={`gtab ${name === activeGroup ? "active" : ""}`}
                onClick={() => handleGroupChange(name)}
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
        <div className="section-header">
          <div className="section-label">Character mastery &amp; speed</div>
          <select
            className="mastery-sort"
            value={masterySort}
            onChange={(event) =>
              setMasterySort(event.target.value as MasterySort)
            }
            aria-label="Sort characters"
          >
            {MASTERY_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
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
          {sortedMastery.map((cell) => {
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
