import levelEntries from "./levels.js";
import { validateLevel } from "./level-blocks.js";
import { ENABLE_CONSOLE_COMPLETION } from "./debug-config.js";
import {
  getProgressSummary,
  recordLevelCompletion,
} from "./progress.js";

const LEVELS = levelEntries.filter(Boolean);
const levelsById = new Map(LEVELS.map((entry) => [entry.id, entry]));
const levelContent = document.querySelector("#level-content");
const levelNavigation = document.querySelector("#level-navigation");
const routeBack = document.querySelector("#route-back");
const postgameReturn = document.querySelector("#postgame-return");

let activeSession = null;
let renderRequestId = 0;
let markdownRendererPromise = null;
let mathRendererPromise = null;
const MARKED_URL = "https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js";
const KATEX_BASE_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.22/dist";
const MATH_OPTIONS = {
  delimiters: [
    { left: "$$", right: "$$", display: true },
    { left: "\\[", right: "\\]", display: true },
    { left: "$", right: "$", display: false },
    { left: "\\(", right: "\\)", display: false },
  ],
  throwOnError: false,
};

function getLevelEntryFromHash() {
  const id = decodeURIComponent(location.hash.replace(/^#/, ""));
  return levelsById.get(id) || LEVELS[0];
}

async function loadTextBlock(block) {
  const response = await fetch(block.src);
  if (!response.ok) {
    throw new Error(`Unable to load ${response.url}: HTTP ${response.status}.`);
  }
  const markdown = await response.text();
  await loadMarkdownRenderer();
  return { ...block, html: window.marked.parse(markdown, { gfm: true }) };
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
  void renderMath(content);
  panel.append(content);
  return { block, element: panel, destroy() {} };
}

async function renderMath(element) {
  try {
    await loadMathRenderer();
    if (!element.isConnected) return;
    window.renderMathInElement(element, MATH_OPTIONS);
  } catch (error) {
    console.error("Unable to render math content.", error);
  }
}

function loadMarkdownRenderer() {
  if (typeof window.marked?.parse === "function") {
    return Promise.resolve();
  }
  if (!markdownRendererPromise) {
    markdownRendererPromise = loadScript(MARKED_URL).then(() => {
      if (typeof window.marked?.parse !== "function") {
        throw new Error("Marked did not initialize.");
      }
    });
  }
  return markdownRendererPromise;
}

function loadMathRenderer() {
  if (typeof window.renderMathInElement === "function") {
    return Promise.resolve();
  }
  if (!mathRendererPromise) {
    mathRendererPromise = Promise.all([
      loadStylesheet(`${KATEX_BASE_URL}/katex.min.css`),
      loadScript(`${KATEX_BASE_URL}/katex.min.js`).then(() =>
        loadScript(`${KATEX_BASE_URL}/contrib/auto-render.min.js`),
      ),
    ]).then(() => {
      if (typeof window.renderMathInElement !== "function") {
        throw new Error("KaTeX auto-render did not initialize.");
      }
    });
  }
  return mathRendererPromise;
}

function loadStylesheet(href) {
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", () => reject(new Error(`Unable to load ${href}.`)), {
      once: true,
    });
    document.head.append(link);
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error(`Unable to load ${src}.`)), {
      once: true,
    });
    document.head.append(script);
  });
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
  canvas.width = 1;
  canvas.height = 1;
  if (config.accessibility?.focusable) canvas.tabIndex = 0;
  canvas.setAttribute("role", config.accessibility?.role || "img");
  canvas.setAttribute("aria-label", config.title);
  const accessory = document.createElement("div");
  accessory.className = "canvas-accessory";
  const caption = document.createElement("div");
  caption.className = "canvas-caption";
  caption.textContent = config.caption || "";
  frame.append(canvas);
  content.append(frame, accessory, caption);
  panel.append(titleRow, content);

  let controller = null;
  let initializationFailed = false;
  const initialize = () => {
    if (controller || initializationFailed || session.destroyed) {
      return;
    }
    let candidate = null;
    try {
      candidate = config.createController({
        config,
        canvas,
        mount: accessory,
        onSolved: (options = {}) => markCanvasSolved(
          session,
          canvasIndex,
          state,
          options.revealDelayMs ?? config.revealDelayMs ?? 0,
        ),
      });
      if (
        !candidate ||
        typeof candidate.destroy !== "function" ||
        typeof candidate.setActive !== "function"
      ) {
        candidate?.destroy?.();
        throw new TypeError(
          `Canvas "${config.title}" controller must provide setActive() and destroy().`,
        );
      }
      candidate.setActive(true);
      controller = candidate;
    } catch (error) {
      candidate?.destroy?.();
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
      if (controller) controller.setActive(true);
      else initialize();
      if (controller) startCanvasTimer(session, canvasIndex);
      if (!session.canvasState[canvasIndex]) {
        scrollToBlock(panel);
      }
    } else {
      controller?.setActive(false);
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

function renderComponentBlock(config) {
  const panel = document.createElement("section");
  panel.className = config.className || "story-panel";
  const mount = document.createElement("div");
  mount.className = "component-host";
  panel.append(mount);
  const controller = config.createController({ config, mount });
  if (!controller || typeof controller.destroy !== "function") {
    controller?.destroy?.();
    throw new TypeError("Component controller must provide destroy().");
  }
  return {
    block: config,
    element: panel,
    destroy() {
      controller.destroy();
    },
  };
}

function renderBlock(session, block, blockIndex) {
  if (block.type === "text") return renderRichTextBlock(session, block);
  if (block.type === "canvas") return renderCanvasBlock(session, block, blockIndex);
  if (block.type === "component") return renderComponentBlock(block);
  if (block.type === "actions") return renderActionsBlock(block);
  throw new Error(`Unknown level block type: "${block.type}".`);
}

function completeLevel(session) {
  if (session.destroyed || session.isComplete) return false;
  session.isComplete = true;
  const canvasMs = session.canvasTiming.map((timing) => timing.elapsedMs || 0);
  const elapsedMs = canvasMs.reduce((total, duration) => total + duration, 0);
  recordLevelCompletion(session.level.id, elapsedMs, canvasMs);
  updateLevelNavigation(levelsById.get(session.level.id));
  return true;
}

function startCanvasTimer(session, canvasIndex) {
  const timing = session.canvasTiming[canvasIndex];
  if (timing && timing.startedAt == null && timing.elapsedMs == null) {
    timing.startedAt = performance.now();
  }
}

function finishCanvasTimer(session, canvasIndex) {
  const timing = session.canvasTiming[canvasIndex];
  if (!timing || timing.elapsedMs != null) return;
  timing.elapsedMs = timing.startedAt == null
    ? 0
    : performance.now() - timing.startedAt;
}

function markCanvasSolved(session, canvasIndex, badge, revealDelayMs = 0) {
  if (session !== activeSession || session.destroyed || session.canvasState[canvasIndex]) {
    return;
  }
  finishCanvasTimer(session, canvasIndex);
  session.canvasState[canvasIndex] = true;
  badge.classList.add("is-solved");
  badge.setAttribute("aria-label", "已完成");
  if (session.canvasState.every(Boolean)) {
    completeLevel(session);
  }
  const reveal = () => {
    if (session !== activeSession || session.destroyed) return;
    const newlyVisible = updateBlockVisibility(session);
    if (newlyVisible.length > 0) scrollToBlock(newlyVisible[0]);
  };
  if (revealDelayMs > 0) {
    const timer = window.setTimeout(reveal, revealDelayMs);
    session.revealTimers.push(timer);
  } else {
    reveal();
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
  session.revealTimers.forEach((timer) => window.clearTimeout(timer));
  session.revealTimers = [];
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
    isComplete: false,
    destroyed: false,
    canvasState: Array(level.blocks.filter((block) => block.type === "canvas").length).fill(false),
    canvasTiming: Array.from(
      { length: level.blocks.filter((block) => block.type === "canvas").length },
      () => ({ startedAt: null, elapsedMs: null }),
    ),
    canvasBadges: [],
    renderedBlocks: [],
    revealTimers: [],
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
  updateLevelNavigation(entry);
}

function updateLevelNavigation(entry) {
  if (!levelNavigation || !routeBack || !postgameReturn) return;
  const showBack = Boolean(entry?.back);
  routeBack.hidden = !showBack;
  if (showBack) routeBack.href = `#${encodeURIComponent(entry.back)}`;
  const showResults = getProgressSummary().cleared &&
    entry?.id !== "results";
  postgameReturn.hidden = !showResults;
  levelNavigation.hidden = !showBack && !showResults;
}

function completeCurrentLevelFromConsole() {
  const session = activeSession;
  if (!session || session.destroyed) return null;
  session.canvasState.forEach((solved, index) => {
    if (solved) return;
    finishCanvasTimer(session, index);
    session.canvasState[index] = true;
    const badge = session.canvasBadges[index];
    badge?.classList.add("is-solved");
    badge?.setAttribute("aria-label", "已完成");
  });
  completeLevel(session);
  updateBlockVisibility(session);
  return { id: session.level.id, completed: true };
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
if (ENABLE_CONSOLE_COMPLETION) {
  window.completeCurrentLevel = completeCurrentLevelFromConsole;
}
handleRouteChange();
