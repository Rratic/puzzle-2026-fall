import {
  canvasPointFromEvent,
  resizeCanvasBuffer,
} from "../canvas-utils.js";

export const WIDTH = 960;
export const HEIGHT = 620;

const GRAPH_FRAME = Object.freeze({ x: 24, y: 24, width: 912, height: 572 });
const VERTEX_RADIUS = 24;
const PALETTE = [
  "#e35d5d",
  "#3b9c88",
  "#f1c453",
  "#4d78c9",
];

export function createFourColorController(options) {
  return new PlanarGraphColoringController(options);
}

export function validatePlanarGraph(graph) {
  if (!graph || typeof graph !== "object") {
    throw new TypeError("平面图数据必须是一个对象。");
  }
  if (!Array.isArray(graph.vertices) || graph.vertices.length === 0) {
    throw new TypeError("平面图至少需要一个顶点。");
  }
  if (!Array.isArray(graph.edges)) {
    throw new TypeError("平面图必须提供 edges 数组。");
  }

  const vertexById = new Map();
  const vertices = graph.vertices.map((vertex, index) => {
    if (!vertex || typeof vertex.id !== "string" || vertex.id.length === 0) {
      throw new TypeError(`第 ${index + 1} 个顶点必须提供非空字符串 id。`);
    }
    if (vertexById.has(vertex.id)) {
      throw new Error(`顶点 id "${vertex.id}" 重复。`);
    }
    if (
      !Number.isFinite(vertex.x) || vertex.x < 0 || vertex.x > 1 ||
      !Number.isFinite(vertex.y) || vertex.y < 0 || vertex.y > 1
    ) {
      throw new TypeError(`顶点 "${vertex.id}" 的 x、y 必须在 0 到 1 之间。`);
    }
    const normalized = {
      id: vertex.id,
      x: vertex.x,
      y: vertex.y,
    };
    vertexById.set(vertex.id, index);
    return normalized;
  });

  const seenEdges = new Set();
  const edges = graph.edges.map((edge, index) => {
    if (!Array.isArray(edge) || edge.length !== 2) {
      throw new TypeError(`第 ${index + 1} 条边必须写成 [起点 id, 终点 id]。`);
    }
    const [firstId, secondId] = edge;
    if (!vertexById.has(firstId) || !vertexById.has(secondId)) {
      throw new Error(`边 ${index + 1} 引用了不存在的顶点。`);
    }
    if (firstId === secondId) {
      throw new Error(`顶点 "${firstId}" 上的自环无法进行正常顶点染色。`);
    }
    const first = vertexById.get(firstId);
    const second = vertexById.get(secondId);
    const key = first < second ? `${first}:${second}` : `${second}:${first}`;
    if (seenEdges.has(key)) {
      throw new Error(`边 "${firstId}-${secondId}" 重复。`);
    }
    seenEdges.add(key);
    return { first, second, key };
  });

  return {
    vertices,
    edges,
  };
}

class PlanarGraphColoringController {
  constructor({ config, canvas, onSolved }) {
    this.config = config;
    this.canvas = canvas;
    this.onSolved = onSolved;
    this.ctx = canvas.getContext("2d");
    this.graph = validatePlanarGraph(config.graph);
    this.colors = Array(this.graph.vertices.length).fill(-1);
    this.hoveredVertex = -1;
    this.selectedVertex = -1;
    this.solved = false;

    this.handlePointerDown = (event) => this.onPointerDown(event);
    this.handlePointerMove = (event) => this.onPointerMove(event);
    this.handlePointerLeave = () => this.onPointerLeave();
    this.handleContextMenu = (event) => this.onContextMenu(event);
    this.handleKeyDown = (event) => this.onKeyDown(event);
    this.handleResize = () => {
      resizeCanvasBuffer(canvas, this.ctx, config.width, config.height);
      this.draw();
    };

    this.canvas.style.touchAction = "manipulation";
    resizeCanvasBuffer(canvas, this.ctx, config.width, config.height);
    this.bindEvents();
    this.updateStatus();
    this.draw();
  }

  bindEvents() {
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerleave", this.handlePointerLeave);
    this.canvas.addEventListener("contextmenu", this.handleContextMenu);
    this.canvas.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("resize", this.handleResize);
  }

  destroy() {
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerleave", this.handlePointerLeave);
    this.canvas.removeEventListener("contextmenu", this.handleContextMenu);
    this.canvas.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("resize", this.handleResize);
  }

  onPointerDown(event) {
    if (this.solved) return;
    event.preventDefault();
    this.canvas.focus({ preventScroll: true });
    const point = this.eventPoint(event);

    const vertex = this.findVertex(point);
    if (vertex < 0) return;
    this.selectedVertex = vertex;
    this.colors[vertex] = (this.colors[vertex] + 1) % PALETTE.length;
    this.updateAndDraw();
    this.checkSolved();
  }

  onPointerMove(event) {
    const point = this.eventPoint(event);
    const next = this.findVertex(point);
    if (next === this.hoveredVertex) return;
    this.hoveredVertex = next;
    this.canvas.style.cursor = next >= 0 ? "pointer" : "default";
    this.draw();
  }

  onPointerLeave() {
    if (this.hoveredVertex < 0) return;
    this.hoveredVertex = -1;
    this.canvas.style.cursor = "default";
    this.draw();
  }

  onContextMenu(event) {
    if (this.solved) return;
    const vertex = this.findVertex(this.eventPoint(event));
    if (vertex < 0) return;
    event.preventDefault();
    this.selectedVertex = vertex;
    this.colors[vertex] = -1;
    this.updateAndDraw();
  }

  onKeyDown(event) {
    if (this.solved) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      this.moveSelection(1);
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      this.moveSelection(-1);
      return;
    }
    if (this.selectedVertex < 0) return;

    const numericColor = Number(event.key) - 1;
    if (numericColor >= 0 && numericColor < PALETTE.length) {
      event.preventDefault();
      this.colors[this.selectedVertex] = numericColor;
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      this.colors[this.selectedVertex] =
        (this.colors[this.selectedVertex] + 1) % PALETTE.length;
    } else if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      this.colors[this.selectedVertex] = -1;
    } else {
      return;
    }
    this.updateAndDraw();
    this.checkSolved();
  }

  eventPoint(event) {
    return canvasPointFromEvent(
      this.canvas,
      event,
      this.config.width,
      this.config.height,
    );
  }

  moveSelection(amount) {
    const count = this.graph.vertices.length;
    if (this.selectedVertex < 0) {
      this.selectedVertex = amount > 0 ? 0 : count - 1;
      this.updateAndDraw();
      return;
    }
    this.selectedVertex = (this.selectedVertex + amount + count) % count;
    this.updateAndDraw();
  }

  findVertex(point) {
    let closest = -1;
    let closestDistance = VERTEX_RADIUS * VERTEX_RADIUS;
    this.graph.vertices.forEach((vertex, index) => {
      const distance = distanceSquared(point, vertexPoint(vertex));
      if (distance <= closestDistance) {
        closest = index;
        closestDistance = distance;
      }
    });
    return closest;
  }

  getConflicts() {
    return this.graph.edges.filter(({ first, second }) =>
      this.colors[first] >= 0 && this.colors[first] === this.colors[second]
    );
  }

  updateAndDraw() {
    this.updateStatus();
    this.draw();
  }

  updateStatus() {
    const colored = this.colors.filter((color) => color >= 0).length;
    const conflicts = this.getConflicts().length;
    let status = `已着色 ${colored}/${this.graph.vertices.length}`;
    if (conflicts > 0) status += `，有 ${conflicts} 条边的两端同色`;
    if (this.solved) status = "已完成四染色";
    this.canvas.setAttribute("aria-label", `${this.config.title}，${status}`);
  }

  checkSolved() {
    if (
      this.solved ||
      this.colors.some((color) => color < 0) ||
      this.getConflicts().length > 0
    ) {
      return;
    }
    this.solved = true;
    this.updateAndDraw();
    this.onSolved();
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#f7f8f5";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    this.drawGraph();
  }

  drawGraph() {
    const ctx = this.ctx;
    const conflicts = this.getConflicts();

    ctx.save();
    this.graph.edges.forEach((edge) => {
      const first = vertexPoint(this.graph.vertices[edge.first]);
      const second = vertexPoint(this.graph.vertices[edge.second]);
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      ctx.lineTo(second.x, second.y);
      ctx.strokeStyle = "#65716e";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    });

    conflicts.forEach((edge) => {
      const first = vertexPoint(this.graph.vertices[edge.first]);
      const second = vertexPoint(this.graph.vertices[edge.second]);
      drawConflictMark(ctx, {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2,
      });
    });

    this.graph.vertices.forEach((vertex, index) => {
      this.drawVertex(vertex, index);
    });
    ctx.restore();
  }

  drawVertex(vertex, index) {
    const ctx = this.ctx;
    const point = vertexPoint(vertex);
    const colorIndex = this.colors[index];
    const selected = index === this.selectedVertex;
    const hovered = index === this.hoveredVertex && !this.solved;

    ctx.save();
    ctx.beginPath();
    ctx.arc(point.x, point.y, VERTEX_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = colorIndex < 0 ? "#ffffff" : PALETTE[colorIndex];
    ctx.shadowColor = "rgba(23, 36, 34, 0.18)";
    ctx.shadowBlur = hovered ? 12 : 5;
    ctx.shadowOffsetY = 2;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = selected ? "#172422" : hovered ? "#4b5d59" : "#7d8986";
    ctx.lineWidth = selected ? 4 : hovered ? 3 : 2;
    ctx.stroke();
    ctx.restore();
  }
}

function vertexPoint(vertex) {
  return {
    x: GRAPH_FRAME.x + VERTEX_RADIUS + vertex.x *
      (GRAPH_FRAME.width - VERTEX_RADIUS * 2),
    y: GRAPH_FRAME.y + VERTEX_RADIUS + vertex.y *
      (GRAPH_FRAME.height - VERTEX_RADIUS * 2),
  };
}

function distanceSquared(first, second) {
  return (first.x - second.x) ** 2 + (first.y - second.y) ** 2;
}

function drawConflictMark(ctx, point) {
  const radius = 9;
  ctx.save();
  ctx.lineCap = "round";

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 7;
  drawCross(ctx, point, radius);

  ctx.strokeStyle = "#172422";
  ctx.lineWidth = 3;
  drawCross(ctx, point, radius);
  ctx.restore();
}

function drawCross(ctx, point, radius) {
  ctx.beginPath();
  ctx.moveTo(point.x - radius, point.y - radius);
  ctx.lineTo(point.x + radius, point.y + radius);
  ctx.moveTo(point.x + radius, point.y - radius);
  ctx.lineTo(point.x - radius, point.y + radius);
  ctx.stroke();
}
