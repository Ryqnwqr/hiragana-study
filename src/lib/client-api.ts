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
  welcome: {
    mastered: number;
    accuracy: number | null;
    bestStreak: number;
    avgRecall: number | null;
    hasProgress: boolean;
  };
};

type DotMap = Record<string, "unseen" | "seen" | "good" | "mid" | "bad">;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
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

export function syncAuthProgress() {
  return request<{ ok: boolean }>("/api/auth/sync", { method: "POST" });
}

export function resetProgress() {
  return request<{ ok: boolean }>("/api/progress", { method: "DELETE" });
}

export function startRound(group: string) {
  return request<RoundSnapshot & { dotMap: DotMap; deck: PublicCard[] }>(
    "/api/round",
    {
    method: "POST",
      body: JSON.stringify({ group }),
    },
  );
}

export function beginRound() {
  return request<{ snapshot: RoundSnapshot; dotMap: DotMap }>("/api/round/begin", {
    method: "POST",
  });
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

