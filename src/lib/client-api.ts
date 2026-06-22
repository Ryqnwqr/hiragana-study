export type PublicCard = {
  k: string;
  group: string;
};

export type RoundSnapshot = {
  roundId: string;
  group: string;
  roundSize: number;
  remaining: number;
  sessionStreak: number;
  sessionCorrect: number;
  sessionTotal: number;
  avgRecall: number | null;
  masteredCount: number;
  currentCard: PublicCard | null;
  awaitingStart: boolean;
  revealed: boolean;
  roundComplete: boolean;
};

export type ProgressResponse = {
  totalAnswers: number;
  accuracy: number | null;
  bestStreak: number;
  avgRecall: number | null;
  masteredCount: number;
  mastery: Array<{
    k: string;
    r: string;
    group: string;
    level: number;
    avgTime: number | null;
  }>;
  weights: ProgressWeights;
  welcome: {
    mastered: number;
    accuracy: number | null;
    bestStreak: number;
    avgRecall: number | null;
    hasProgress: boolean;
  };
};

export type ProgressWeights = {
  scores: Record<string, number>;
  avgTimes: Record<string, number | null>;
  allTimeSeen: Record<string, number>;
};

type DotMap = Record<string, "unseen" | "seen" | "good" | "mid" | "bad">;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    // "include" (not "same-origin") so cookies are sent inside an iOS
    // standalone/home-screen WebView, which otherwise drops them and breaks
    // session reads and cloud sync. All requests here are same-origin.
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data as T;
}

export function fetchGroups() {
  return request<{ groups: string[] }>("/api/groups");
}

export function fetchProgress() {
  return request<ProgressResponse>("/api/progress");
}

export function syncAuthProgress(tokens: {
  access_token: string;
  refresh_token: string;
}) {
  return request<{ ok: boolean }>("/api/auth/sync", {
    method: "POST",
    body: JSON.stringify(tokens),
  });
}

export function clearGuestSession() {
  return request<{ ok: boolean }>("/api/session/clear", { method: "POST" });
}

export function resetProgress(tokens?: {
  access_token: string;
  refresh_token: string;
}) {
  return request<ProgressResponse>("/api/progress", {
    method: "DELETE",
    // Tokens let the route authenticate the cloud reset even when API-route
    // cookie auth isn't available (production) — otherwise the cloud row
    // survives the reset and gets merged back on the next sync.
    body: JSON.stringify(tokens ?? {}),
  });
}

export function startRound(
  group: string,
  options?: { roundId?: string; deck?: string[] },
) {
  return request<RoundSnapshot & { dotMap: DotMap; deck: PublicCard[] }>(
    "/api/round",
    {
      method: "POST",
      body: JSON.stringify({
        group,
        roundId: options?.roundId,
        deck: options?.deck,
      }),
    },
  );
}

export function revealCard() {
  return request<{
    romaji: string;
    snapshot: RoundSnapshot;
    dotMap: DotMap;
  }>("/api/round/reveal", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function submitAnswer(
  kana: string,
  correct: boolean,
  recallTime: number,
) {
  return request<{
    reinserted: boolean;
    confetti: boolean;
    snapshot: RoundSnapshot;
    dotMap: DotMap;
    deck: PublicCard[];
    roundComplete: boolean;
  }>("/api/round/answer", {
    method: "POST",
    body: JSON.stringify({ kana, correct, recallTime }),
  });
}

