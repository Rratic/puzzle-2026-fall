import levelEntries from "./levels.js";
import { validateLevel } from "./level-blocks.js";

const STORAGE_KEY = "project-111:level-times";
const LEVELS = levelEntries.filter(Boolean);
const levelsById = new Map(LEVELS.map((entry) => [entry.id, entry]));
const levelContent = document.querySelector("#level-content");

let activeSession = null;
let renderRequestId = 0;

function readRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeRecords(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.error("Unable to persist level records.", error);
  }
}

function getLevelEntryFromHash() {
  const id = decodeURIComponent(location.hash.replace(/^#/, ""));
  return levelsById.get(id) || LEVELS[0];
}

async function loadTextBlock(block) {
  const response = await fetch(block.src);
  if (!response.ok) {
    throw new Error(`Unable to load ${response.url}: HTTP ${response.status}.`);
  }
  return { ...block, html: await response.text() };
}

async function loadLevel(entry) {
  const module = await entry.load();
  const level = validateLevel(module.default, entry.id, levelsById);
  const blocks = await Promise.all(
    level.blocks.map((block) => block.type === "text" ? loadTextBlock(block) : block),
  );
  return { ...level, blocks };
}

function isBlockUnlocked(session, blockIndex) {
  const precedingCanvasCount = session.level.blocks
    .slice(0, blockIndex)
    .filter((block) => block.type === "canvas")
    .length;
  return session.canvasState.slice(0, precedingCanvasCount).every(Boolean);
}

function scrollToBlock(element) {
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
  window.requestAnimationFrame(() => {
    if (element.isConnected) {
      element.scrollIntoView({ behavior, block: "start" });
    }
  });
}

function updateBlockVisibility(session) {
  const newlyVisible = [];
  session.renderedBlocks.forEach(({ element }, index) => {
    const unlocked = isBlockUnlocked(session, index);
    if (element.hidden && unlocked) {
      newlyVisible.push(element);
    }
    element.hidden = !unlocked;
  });
  return newlyVisible;
}

function renderRichTextBlock(session, block) {
  const panel = document.createElement("article");
  panel.className = "story-panel";
  if (block.kicker) {
    const kicker = document.createElement("div");
    kicker.className = "level-kicker";
    kicker.textContent = session.level.id;
    panel.append(kicker);
  }
  if (block.title) {
    const title = document.createElement("h1");
    title.textContent = block.title;
    panel.append(title);
  }
  const content = document.createElement("div");
  content.className = "rich-text";
  content.innerHTML = block.html || "";
  panel.append(content);
  return { block, element: panel, destroy() {} };
}

function renderCanvasBlock(session, config, blockIndex) {
  const canvasIndex = session.canvasBadges.length;
  const panel = document.createElement("section");
  panel.className = "canvas-panel";

  const contentId = `canvas-panel-content-${blockIndex}`;
  const titleRow = document.createElement("button");
  titleRow.className = "canvas-title-row";
  titleRow.type = "button";
  titleRow.setAttribute("aria-expanded", "false");
  titleRow.setAttribute("aria-controls", contentId);

  const title = document.createElement("span");
  title.className = "canvas-title";
  title.textContent = config.title;
  const state = document.createElement("span");
  state.className = "canvas-state";
  state.setAttribute("aria-label", "未完成");
  state.setAttribute("aria-live", "polite");
  session.canvasBadges.push(state);
  const controls = document.createElement("span");
  controls.className = "canvas-controls";
  controls.append(state);
  titleRow.append(title, controls);

  const content = document.createElement("div");
  content.className = "canvas-panel-content";
  content.id = contentId;
  content.hidden = true;
  const frame = document.createElement("div");
  frame.className = "canvas-frame";
  frame.style.setProperty("--canvas-width", config.width);
  frame.style.setProperty("--canvas-height", config.height);
  const canvas = document.createElement("canvas");
  canvas.className = "puzzle-canvas";
  canvas.width = config.width;
  canvas.height = config.height;
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", config.title);
  const caption = document.createElement("div");
  caption.className = "canvas-caption";
  caption.textContent = config.caption || "";
  frame.append(canvas);
  content.append(frame, caption);
  panel.append(titleRow, content);

  let controller = null;
  let initializationFailed = false;
  const initialize = () => {
    if (controller || initializationFailed || session.destroyed) {
      return;
    }
    try {
      const candidate = config.createController({
        config,
        canvas,
        onSolved: () => markCanvasSolved(session, canvasIndex, state),
      });
      if (!candidate || typeof candidate.destroy !== "function") {
        candidate?.destroy?.();
        throw new TypeError(`Canvas "${config.title}" controller must provide destroy().`);
      }
      controller = candidate;
    } catch (error) {
      initializationFailed = true;
      caption.classList.add("canvas-error");
      caption.textContent = "题目初始化失败。";
      canvas.hidden = true;
      console.error(error);
    }
  };

  const handleToggle = () => {
    const isExpanded = titleRow.getAttribute("aria-expanded") === "true";
    titleRow.setAttribute("aria-expanded", String(!isExpanded));
    content.hidden = isExpanded;
    if (!isExpanded) {
      initialize();
      if (!session.canvasState[canvasIndex]) {
        scrollToBlock(panel);
      }
    }
  };
  titleRow.addEventListener("click", handleToggle);

  return {
    block: config,
    element: panel,
    destroy() {
      titleRow.removeEventListener("click", handleToggle);
      destroyController(controller);
      controller = null;
    },
  };
}

function renderActionsBlock(block) {
  const panel = document.createElement("footer");
  panel.className = "level-actions";
  const actions = document.createElement("div");
  actions.className = "exit-actions";
  actions.append(...block.actions.map((action) => {
    const link = document.createElement("a");
    link.className = "exit-button";
    link.href = `#${encodeURIComponent(action.target)}`;
    link.textContent = action.label;
    return link;
  }));
  panel.append(actions);
  return { block, element: panel, destroy() {} };
}

function renderBlock(session, block, blockIndex) {
  if (block.type === "text") return renderRichTextBlock(session, block);
  if (block.type === "canvas") return renderCanvasBlock(session, block, blockIndex);
  if (block.type === "actions") return renderActionsBlock(block);
  throw new Error(`Unknown level block type: "${block.type}".`);
}

function completeLevel(session) {
  if (session.destroyed || session.isComplete) return false;
  session.isComplete = true;
  const elapsedMs = performance.now() - session.startedAt;
  const records = readRecords();
  const current = records[session.level.id] || {};
  const previousCompletions = current.completions ?? current.attempts ?? 0;
  records[session.level.id] = {
    completions: previousCompletions + 1,
    bestMs: current.bestMs == null ? elapsedMs : Math.min(current.bestMs, elapsedMs),
    lastMs: elapsedMs,
    completedAt: new Date().toISOString(),
  };
  writeRecords(records);
  return true;
}

function markCanvasSolved(session, canvasIndex, badge) {
  if (session !== activeSession || session.destroyed || session.canvasState[canvasIndex]) {
    return;
  }
  session.canvasState[canvasIndex] = true;
  badge.classList.add("is-solved");
  badge.setAttribute("aria-label", "已完成");
  const newlyVisible = updateBlockVisibility(session);
  if (session.canvasState.every(Boolean)) {
    completeLevel(session);
  }
  if (newlyVisible.length > 0) {
    scrollToBlock(newlyVisible[0]);
  }
}

function destroyController(controller) {
  if (!controller) return;
  try {
    controller.destroy();
  } catch (error) {
    console.error("Unable to destroy canvas controller.", error);
  }
}

function destroySession(session) {
  if (!session || session.destroyed) return;
  session.destroyed = true;
  session.renderedBlocks.forEach((block) => {
    try {
      block.destroy();
    } catch (error) {
      console.error("Unable to destroy level block.", error);
    }
  });
  session.renderedBlocks = [];
}

function showLoadError(entry, error) {
  destroySession(activeSession);
  activeSession = null;
  const panel = document.createElement("article");
  panel.className = "story-panel";
  const title = document.createElement("h1");
  title.textContent = entry.id;
  const content = document.createElement("div");
  content.className = "rich-text";
  const message = document.createElement("p");
  message.textContent = "关卡内容加载失败。";
  content.append(message);
  panel.append(title, content);
  levelContent.replaceChildren(panel);
  console.error(error);
}

async function renderLevel(entry) {
  const requestId = ++renderRequestId;
  let level;
  try {
    level = await loadLevel(entry);
  } catch (error) {
    if (requestId === renderRequestId) showLoadError(entry, error);
    return;
  }
  if (requestId !== renderRequestId) return;

  const session = {
    level,
    startedAt: performance.now(),
    isComplete: false,
    destroyed: false,
    canvasState: Array(level.blocks.filter((block) => block.type === "canvas").length).fill(false),
    canvasBadges: [],
    renderedBlocks: [],
  };
  try {
    level.blocks.forEach((block, index) => {
      session.renderedBlocks.push(renderBlock(session, block, index));
    });
  } catch (error) {
    destroySession(session);
    if (requestId === renderRequestId) showLoadError(entry, error);
    return;
  }

  destroySession(activeSession);
  activeSession = session;
  levelContent.replaceChildren(...session.renderedBlocks.map(({ element }) => element));
  updateBlockVisibility(session);
}

function handleRouteChange() {
  const requestedId = decodeURIComponent(location.hash.replace(/^#/, ""));
  const entry = getLevelEntryFromHash();
  if (!entry) return;
  if (requestedId !== entry.id) {
    history.replaceState(null, "", `#${encodeURIComponent(entry.id)}`);
  }
  void renderLevel(entry);
}

window.addEventListener("hashchange", handleRouteChange);
handleRouteChange();
