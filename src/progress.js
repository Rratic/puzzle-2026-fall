const STORAGE_KEY = "progress";

export const PUZZLE_LEVELS = Object.freeze([
  Object.freeze({ id: "library", label: "书架" }),
  Object.freeze({ id: "mines", label: "扫雷" }),
  Object.freeze({ id: "maps", label: "平面图四染色" }),
  Object.freeze({ id: "hyperbolic", label: "双曲圆盘" }),
  Object.freeze({ id: "compass", label: "单规作图" }),
  Object.freeze({ id: "numbers", label: "凑数字" }),
  Object.freeze({ id: "quadratic", label: "二次曲线作图" }),
  Object.freeze({ id: "knots", label: "扭结不变量" }),
  Object.freeze({ id: "ritual", label: "正则图" }),
]);

const CLEAR_ROUTES = Object.freeze([
  Object.freeze(["mines", "maps", "hyperbolic", "compass", "knots", "ritual"]),
  Object.freeze(["mines", "maps", "numbers", "quadratic", "knots", "ritual"]),
]);

const PREREQUISITES = Object.freeze({
  maps: ["mines"],
  hyperbolic: ["maps"],
  compass: ["hyperbolic"],
  numbers: ["maps"],
  quadratic: ["numbers"],
  ritual: ["knots"],
});

export function readProgressRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

export function recordLevelCompletion(levelId, elapsedMs, canvasMs) {
  const records = readProgressRecords();
  const current = records[levelId] || {};
  const previousCompletions = current.completions ?? current.attempts ?? 0;
  records[levelId] = {
    completions: previousCompletions + 1,
    bestMs: current.bestMs == null ? elapsedMs : Math.min(current.bestMs, elapsedMs),
    lastMs: elapsedMs,
    canvasMs,
    completedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.error("Unable to persist level records.", error);
  }
}

export function getProgressSummary(records = readProgressRecords()) {
  const levels = PUZZLE_LEVELS.map((level) => {
    const record = records[level.id];
    return {
      ...level,
      completed: Boolean(record?.completions || record?.completedAt),
      durationMs: getRecordDuration(record),
    };
  });
  const durationById = new Map(levels.map((level) => [level.id, level.durationMs]));
  const completedById = new Map(levels.map((level) => [level.id, level.completed]));
  levels.forEach((level) => {
    if (level.completed) {
      level.available = false;
      return;
    }
    if (level.id === "knots") {
      level.available = Boolean(
        completedById.get("compass") || completedById.get("quadratic"),
      );
      return;
    }
    level.available = (PREREQUISITES[level.id] || []).every((id) =>
      completedById.get(id)
    );
  });
  const completedRoutes = CLEAR_ROUTES.filter((route) =>
    route.every((id) => completedById.get(id))
  );
  const timedRoutes = completedRoutes.filter((route) =>
    route.every((id) => Number.isFinite(durationById.get(id)))
  );
  const clearMs = timedRoutes.length > 0
    ? Math.min(...timedRoutes.map((route) =>
      route.reduce((total, id) => total + (durationById.get(id) || 0), 0)
    ))
    : null;
  const allCompleted = levels.every((level) => level.completed);
  const allTimed = levels.every((level) => Number.isFinite(level.durationMs));
  const allMs = allCompleted && allTimed
    ? levels.reduce((total, level) => total + (level.durationMs || 0), 0)
    : null;

  return {
    levels,
    cleared: completedRoutes.length > 0,
    allCompleted,
    clearMs,
    allMs,
    completedCount: levels.filter((level) => level.completed).length,
  };
}

export function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds)) return "--";
  const totalMilliseconds = Math.max(0, Math.round(milliseconds));
  const hours = Math.floor(totalMilliseconds / 3600000);
  const minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
  const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
  const fraction = totalMilliseconds % 1000;
  const core = hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
  return `${core}.${String(fraction).padStart(3, "0")}`;
}

function getRecordDuration(record) {
  if (!record || !Array.isArray(record.canvasMs)) return null;
  if (Number.isFinite(record.lastMs)) return record.lastMs;
  if (Number.isFinite(record.bestMs)) return record.bestMs;
  return null;
}
