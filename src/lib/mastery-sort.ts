export type MasterySort =
  | "deck"
  | "mastery-desc"
  | "mastery-asc"
  | "speed-fast"
  | "speed-slow"
  | "group";

export type MasteryCell = {
  k: string;
  r: string;
  group: string;
  level: number;
  avgTime: number | null;
};

export const MASTERY_SORT_OPTIONS: Array<{ value: MasterySort; label: string }> = [
  { value: "deck", label: "Deck order" },
  { value: "mastery-desc", label: "Mastery high → low" },
  { value: "mastery-asc", label: "Mastery low → high" },
  { value: "speed-fast", label: "Fastest recall" },
  { value: "speed-slow", label: "Slowest recall" },
  { value: "group", label: "By group" },
];

function compareKana(a: MasteryCell, b: MasteryCell) {
  return a.k.localeCompare(b.k, "ja");
}

function compareSpeed(
  a: MasteryCell,
  b: MasteryCell,
  direction: "asc" | "desc",
) {
  if (a.avgTime == null && b.avgTime == null) return compareKana(a, b);
  if (a.avgTime == null) return 1;
  if (b.avgTime == null) return -1;
  const delta =
    direction === "asc" ? a.avgTime - b.avgTime : b.avgTime - a.avgTime;
  return delta || compareKana(a, b);
}

export function sortMasteryCells(
  cells: MasteryCell[],
  sort: MasterySort,
): MasteryCell[] {
  const copy = [...cells];

  switch (sort) {
    case "mastery-desc":
      return copy.sort(
        (a, b) => b.level - a.level || compareKana(a, b),
      );
    case "mastery-asc":
      return copy.sort(
        (a, b) => a.level - b.level || compareKana(a, b),
      );
    case "speed-fast":
      return copy.sort((a, b) => compareSpeed(a, b, "asc"));
    case "speed-slow":
      return copy.sort((a, b) => compareSpeed(a, b, "desc"));
    case "group":
      return copy.sort(
        (a, b) => a.group.localeCompare(b.group) || compareKana(a, b),
      );
    default:
      return copy;
  }
}
