import {
  canvasPointFromEvent,
  createCanvasLifecycle,
  resizeCanvasBuffer,
} from "../canvas-utils.js";
import {
  INITIAL_PHASES,
  PHASE_BUNDLES,
  analyzeHoffmanSingletonGraph,
  createHoffmanSingletonGraph,
  pointVertexIndex,
} from "./hoffman-singleton.js";

const TAU = Math.PI * 2;
const ROOT = pointVertexIndex(0, 0);
const INNER_RADIUS = 126;
const OUTER_RADIUS = 266;
const NODE_COLORS = Object.freeze({
  point: "#2f7278",
  line: "#96546a",
  root: "#c29a28",
  ink: "#202725",
  paper: "#f8f8f4",
});
const BUNDLE_COLORS = Object.freeze(["#b98b20", "#397d89", "#89576c"]);

export function createRitualController(options) {
  return new RitualController(options);
}

class RitualController {
  constructor({ config, canvas, onSolved }) {
    this.config = config;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onSolved = onSolved;
    this.phases = [...INITIAL_PHASES];
    this.selectedBundle = 0;
    this.hoveredRegion = -1;
    this.phaseRegions = [];
    this.controlScale = 1;
    this.solved = false;
    this.completionNotified = false;
    this.animationFrame = 0;
    this.animationStartedAt = 0;
    this.animationDuration = 2400;
    this.baseGraph = createHoffmanSingletonGraph();
    this.positions = createRitualLayout(
      this.baseGraph,
      ROOT,
      config.width,
      config.height,
    );
    this.rebuildGraph();

    this.handlePointerDown = (event) => this.onPointerDown(event);
    this.handlePointerMove = (event) => this.onPointerMove(event);
    this.handlePointerLeave = () => this.onPointerLeave();
    this.handleKeyDown = (event) => this.onKeyDown(event);
    this.handleResize = () => {
      const bufferChanged = resizeCanvasBuffer(canvas, this.ctx, config.width, config.height);
      const layoutChanged = this.updateResponsiveLayout();
      if (bufferChanged || layoutChanged) this.draw();
    };

    this.canvas.style.touchAction = "manipulation";
    this.lifecycle = createCanvasLifecycle({
      canvas,
      events: [
        { type: "pointerdown", listener: this.handlePointerDown },
        { type: "pointermove", listener: this.handlePointerMove },
        { type: "pointerleave", listener: this.handlePointerLeave },
        { type: "keydown", listener: this.handleKeyDown },
      ],
      onResize: this.handleResize,
      onDeactivate: () => {
        window.cancelAnimationFrame(this.animationFrame);
        this.animationFrame = 0;
        this.hoveredRegion = -1;
        this.canvas.style.cursor = "default";
        if (this.solved) this.finishCompletion();
      },
    });
    this.updateAccessibility();
  }

  setActive(active) {
    this.lifecycle.setActive(active);
  }

  destroy() {
    this.lifecycle.destroy();
    window.cancelAnimationFrame(this.animationFrame);
  }

  rebuildGraph() {
    this.graph = createHoffmanSingletonGraph(this.phases);
    this.analysis = analyzeHoffmanSingletonGraph(this.graph);
  }

  onPointerDown(event) {
    if (this.solved) return;
    const point = this.eventPoint(event);
    const regionIndex = this.findPhaseRegion(point);
    if (regionIndex < 0) return;
    event.preventDefault();
    this.canvas.focus({ preventScroll: true });
    const region = this.phaseRegions[regionIndex];
    this.selectedBundle = region.bundle;
    this.setPhase(region.bundle, region.phase);
  }

  onPointerMove(event) {
    if (this.solved) return;
    const next = this.findPhaseRegion(this.eventPoint(event));
    if (next === this.hoveredRegion) return;
    this.hoveredRegion = next;
    this.canvas.style.cursor = next >= 0 ? "pointer" : "default";
    this.draw();
  }

  onPointerLeave() {
    if (this.hoveredRegion < 0) return;
    this.hoveredRegion = -1;
    this.canvas.style.cursor = "default";
    this.draw();
  }

  onKeyDown(event) {
    if (this.solved) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      this.selectedBundle = modulo(this.selectedBundle + direction, PHASE_BUNDLES.length);
      this.updateAccessibility();
      this.draw();
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === " ") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? -1 : 1;
      this.setPhase(
        this.selectedBundle,
        modulo(this.phases[this.selectedBundle] + direction, 5),
      );
      return;
    }
    const phase = Number(event.key);
    if (Number.isInteger(phase) && phase >= 0 && phase < 5) {
      event.preventDefault();
      this.setPhase(this.selectedBundle, phase);
    }
  }

  setPhase(bundle, phase) {
    if (this.phases[bundle] === phase) {
      this.updateAccessibility();
      this.draw();
      return;
    }
    this.phases[bundle] = phase;
    this.rebuildGraph();
    this.updateAccessibility();
    if (this.analysis.solved) {
      this.solved = true;
      this.animationStartedAt = performance.now();
      this.animationDuration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 2400;
      this.updateAccessibility();
      if (this.animationDuration === 0) {
        this.draw(this.animationStartedAt);
        this.finishCompletion();
      } else {
        this.startCompletionAnimation();
      }
      return;
    }
    this.draw();
  }

  startCompletionAnimation() {
    window.cancelAnimationFrame(this.animationFrame);
    this.draw(this.animationStartedAt);
    const tick = (now) => {
      this.draw(now);
      if (now - this.animationStartedAt < this.animationDuration && this.lifecycle.active) {
        this.animationFrame = window.requestAnimationFrame(tick);
      } else {
        this.animationFrame = 0;
        this.draw(this.animationStartedAt + this.animationDuration);
        this.finishCompletion();
      }
    };
    this.animationFrame = window.requestAnimationFrame(tick);
  }

  finishCompletion() {
    if (this.completionNotified) return;
    this.completionNotified = true;
    this.onSolved();
  }

  eventPoint(event) {
    return canvasPointFromEvent(
      this.canvas,
      event,
      this.config.width,
      this.config.height,
    );
  }

  findPhaseRegion(point) {
    for (let bundle = 0; bundle < PHASE_BUNDLES.length; bundle += 1) {
      const dial = this.dialGeometry(bundle);
      const dx = point.x - dial.x;
      const dy = point.y - dial.y;
      const distance = Math.hypot(dx, dy);
      if (distance < dial.radius * 0.45 || distance > dial.radius * 1.65) continue;
      const angle = modulo(Math.atan2(dy, dx) + Math.PI / 2, TAU);
      const phase = modulo(Math.round((angle / TAU) * 5), 5);
      return bundle * 5 + phase;
    }
    return -1;
  }

  updateResponsiveLayout() {
    const previous = this.controlScale;
    const displayWidth = this.canvas.getBoundingClientRect().width || this.config.width;
    const displayScale = displayWidth / this.config.width;
    this.controlScale = displayWidth < 700
      ? Math.min(1.45, Math.max(1, 44 / (84 * displayScale)))
      : 1;
    return Math.abs(previous - this.controlScale) > 0.001;
  }

  dialGeometry(bundle) {
    const spacing = 154 * this.controlScale;
    return {
      x: this.config.width / 2 + (bundle - 1) * spacing,
      y: this.config.height - 66 * this.controlScale,
      radius: 42 * this.controlScale,
    };
  }

  updateAccessibility() {
    const phaseText = this.phases.join("、");
    const status = this.solved
      ? "法阵已经稳定，频率为 7、2、负 3"
      : `当前相位 ${phaseText}，还有 ${this.analysis.violationCount} 处异常`;
    this.canvas.setAttribute("aria-label", `${this.config.title}，${status}`);
  }

  draw(now = performance.now()) {
    const ctx = this.ctx;
    const { width, height } = this.config;
    const completionProgress = this.solved
      ? Math.min(
        1,
        Math.max(0, (now - this.animationStartedAt) / (this.animationDuration || 1)),
      )
      : 0;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = NODE_COLORS.paper;
    ctx.fillRect(0, 0, width, height);
    this.drawRitualGuides(completionProgress);
    this.drawEdges(completionProgress);
    if (!this.solved) this.drawViolationMarks();
    this.drawVertices(completionProgress, now);
    if (this.solved) this.drawFrequencies(completionProgress);
    else this.drawPhaseControls();
  }

  drawRitualGuides(progress) {
    const ctx = this.ctx;
    const center = ritualCenter(this.config.width);
    ctx.save();
    ctx.strokeStyle = progress > 0 ? "rgba(132, 91, 151, 0.58)" : "#c9afd3";
    ctx.lineWidth = 1.4 + progress * 0.6;
    ctx.setLineDash([7, 8]);
    [54, INNER_RADIUS, OUTER_RADIUS].forEach((radius) => {
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, TAU);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.strokeStyle = progress > 0 ? "rgba(132, 91, 151, 0.32)" : "#e2d5e7";
    ctx.lineWidth = 1;
    for (let sector = 0; sector < 7; sector += 1) {
      const angle = -Math.PI / 2 + (sector / 7) * TAU;
      ctx.beginPath();
      ctx.moveTo(center.x + Math.cos(angle) * 54, center.y + Math.sin(angle) * 54);
      ctx.lineTo(
        center.x + Math.cos(angle) * (OUTER_RADIUS + 18),
        center.y + Math.sin(angle) * (OUTER_RADIUS + 18),
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  drawEdges(progress) {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = "round";
    this.graph.edges.forEach((edge) => {
      const first = this.positions[edge.first];
      const second = this.positions[edge.second];
      const isBundle = edge.bundle >= 0;
      const isSelected = edge.bundle === this.selectedBundle && !this.solved;
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      ctx.lineTo(second.x, second.y);
      if (this.solved) {
        ctx.strokeStyle = `rgba(45, 108, 88, ${0.16 + progress * 0.34})`;
        ctx.lineWidth = 1 + progress * 0.8;
      } else if (isSelected) {
        ctx.strokeStyle = BUNDLE_COLORS[edge.bundle];
        ctx.lineWidth = 2.8;
      } else if (isBundle) {
        ctx.strokeStyle = BUNDLE_COLORS[edge.bundle];
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.7;
      } else {
        ctx.strokeStyle = "rgba(62, 72, 70, 0.17)";
        ctx.lineWidth = 1;
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    ctx.restore();
  }

  drawViolationMarks() {
    const ctx = this.ctx;
    const marks = selectViolationMarks(
      this.analysis.pairViolations,
      this.positions,
      this.selectedBundle,
      this.graph,
    );
    marks.forEach((point) => {
      ctx.save();
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(248, 248, 244, 0.94)";
      ctx.lineWidth = 6;
      drawCross(ctx, point.x, point.y, 6);
      ctx.strokeStyle = NODE_COLORS.ink;
      ctx.lineWidth = 2.2;
      drawCross(ctx, point.x, point.y, 6);
      ctx.restore();
    });

    const center = ritualCenter(this.config.width);
    ctx.fillStyle = "rgba(248, 248, 244, 0.94)";
    ctx.beginPath();
    ctx.arc(center.x, center.y + 33, 22, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = NODE_COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = NODE_COLORS.ink;
    ctx.font = "700 13px ui-monospace, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(this.analysis.violationCount), center.x, center.y + 34);
  }

  drawVertices(progress, now) {
    const ctx = this.ctx;
    this.graph.vertices.forEach((vertex, index) => {
      const point = this.positions[index];
      const frequency = [7, 2, -3][index % 3];
      const pulse = this.solved
        ? 1 + Math.sin((now - this.animationStartedAt) * 0.004 * frequency) * 0.2 * (1 - progress)
        : 1;
      const radius = (index === ROOT ? 9 : 5.5) * pulse;
      ctx.save();
      ctx.translate(point.x, point.y);
      if (vertex.family === "line") ctx.rotate(Math.PI / 4);
      ctx.fillStyle = index === ROOT
        ? NODE_COLORS.root
        : vertex.family === "point"
          ? NODE_COLORS.point
          : NODE_COLORS.line;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (vertex.family === "line") {
        ctx.rect(-radius, -radius, radius * 2, radius * 2);
      } else {
        ctx.arc(0, 0, radius, 0, TAU);
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
  }

  drawPhaseControls() {
    const ctx = this.ctx;
    this.phaseRegions = [];

    PHASE_BUNDLES.forEach((_, bundle) => {
      const dial = this.dialGeometry(bundle);
      const selected = bundle === this.selectedBundle;
      ctx.save();
      ctx.strokeStyle = BUNDLE_COLORS[bundle];
      ctx.lineWidth = selected ? 3 : 1.5;
      ctx.beginPath();
      ctx.arc(dial.x, dial.y, dial.radius, 0, TAU);
      ctx.stroke();

      for (let phase = 0; phase < 5; phase += 1) {
        const angle = -Math.PI / 2 + (phase / 5) * TAU;
        const x = dial.x + Math.cos(angle) * dial.radius;
        const y = dial.y + Math.sin(angle) * dial.radius;
        const regionIndex = this.phaseRegions.length;
        const hovered = regionIndex === this.hoveredRegion;
        const active = phase === this.phases[bundle];
        ctx.fillStyle = active ? BUNDLE_COLORS[bundle] : "#ffffff";
        ctx.strokeStyle = BUNDLE_COLORS[bundle];
        ctx.lineWidth = hovered ? 3 : 1.5;
        ctx.beginPath();
        ctx.arc(
          x,
          y,
          (hovered ? 9 : 7) * this.controlScale,
          0,
          TAU,
        );
        ctx.fill();
        ctx.stroke();
        this.phaseRegions.push({ bundle, phase, x, y });
      }

      ctx.fillStyle = BUNDLE_COLORS[bundle];
      ctx.font = `700 ${17 * this.controlScale}px ui-monospace, Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(bundle + 1), dial.x, dial.y + 1);
      ctx.restore();
    });
  }

  drawFrequencies(progress) {
    const ctx = this.ctx;
    [7, 2, -3].forEach((frequency, index) => {
      const dial = this.dialGeometry(index);
      const radius = (28 + progress * 12) * this.controlScale;
      ctx.save();
      ctx.strokeStyle = BUNDLE_COLORS[index];
      ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(dial.x, dial.y, radius, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = BUNDLE_COLORS[index];
      ctx.font = `700 ${22 * this.controlScale}px ui-monospace, Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(frequency), dial.x, dial.y + 1);
      ctx.restore();
    });
  }
}

function createRitualLayout(graph, root, width) {
  const positions = Array(graph.vertices.length);
  const center = ritualCenter(width);
  positions[root] = center;
  const inner = [...graph.adjacency[root]].sort((first, second) => first - second);
  const innerSet = new Set(inner);

  inner.forEach((vertex, sector) => {
    const angle = -Math.PI / 2 + (sector / inner.length) * TAU;
    positions[vertex] = {
      x: center.x + Math.cos(angle) * INNER_RADIUS,
      y: center.y + Math.sin(angle) * INNER_RADIUS,
    };
    const outer = graph.vertices
      .map((_, index) => index)
      .filter((candidate) =>
        candidate !== root &&
        !innerSet.has(candidate) &&
        graph.adjacency[vertex].has(candidate)
      )
      .sort((first, second) => first - second);
    outer.forEach((candidate, slot) => {
      const outerAngle = angle + (slot - 2.5) * (TAU / 48);
      positions[candidate] = {
        x: center.x + Math.cos(outerAngle) * OUTER_RADIUS,
        y: center.y + Math.sin(outerAngle) * OUTER_RADIUS,
      };
    });
  });

  return positions;
}

function ritualCenter(width) {
  return { x: width / 2, y: 330 };
}

function selectViolationMarks(violations, positions, selectedBundle, graph) {
  const bundleVertices = new Set();
  graph.edges.forEach((edge) => {
    if (edge.bundle === selectedBundle) {
      bundleVertices.add(edge.first);
      bundleVertices.add(edge.second);
    }
  });
  const occupied = [];
  const marks = [];
  const candidates = [
    ...violations.filter((entry) =>
      bundleVertices.has(entry.first) || bundleVertices.has(entry.second)
    ),
    ...violations,
  ];
  for (const violation of candidates) {
    const first = positions[violation.first];
    const second = positions[violation.second];
    const point = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    if (occupied.some((entry) => Math.hypot(entry.x - point.x, entry.y - point.y) < 24)) {
      continue;
    }
    occupied.push(point);
    marks.push(point);
    if (marks.length >= 12) break;
  }
  return marks;
}

function drawCross(ctx, x, y, radius) {
  ctx.beginPath();
  ctx.moveTo(x - radius, y - radius);
  ctx.lineTo(x + radius, y + radius);
  ctx.moveTo(x + radius, y - radius);
  ctx.lineTo(x - radius, y + radius);
  ctx.stroke();
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}
