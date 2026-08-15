import {
  canvasPointFromEvent,
  createCanvasLifecycle,
  pointInRect,
  resizeCanvasBuffer,
  roundedRect,
} from "../canvas-utils.js";

const OPERATORS = [
  { id: "add", symbol: "+", arity: 2, apply: (left, right) => left + right },
  { id: "subtract", symbol: "−", arity: 2, apply: (left, right) => left - right },
  { id: "multiply", symbol: "×", arity: 2, apply: (left, right) => left * right },
  { id: "divide", symbol: "÷", arity: 2, apply: divide },
  { id: "sqrt", symbol: "√", arity: 1, apply: squareRoot },
  { id: "factorial", symbol: "!", arity: 1, apply: factorial },
];

export function createNumbersController(options) {
  return new NumbersController(options);
}

class NumbersController {
  constructor({ config, canvas, onSolved }) {
    this.config = config;
    this.canvas = canvas;
    this.onSolved = onSolved;
    this.ctx = canvas.getContext("2d");
    this.tiles = [];
    this.pending = new Map();
    this.history = [];
    this.tileRegions = [];
    this.operatorRegions = [];
    this.actionRegions = [];
    this.dragging = null;
    this.dragPointerId = null;
    this.nextTileId = 0;
    this.message = "";
    this.messageKind = "neutral";
    this.solved = false;

    this.handleResize = () => {
      if (resizeCanvasBuffer(canvas, this.ctx, config.width, config.height)) {
        this.draw();
      }
    };
    this.handlePointerDown = (event) => this.onPointerDown(event);
    this.handlePointerMove = (event) => this.onPointerMove(event);
    this.handlePointerUp = (event) => this.onPointerUp(event);
    this.handlePointerCancel = () => this.cancelDrag();

    this.resetState();
    this.canvas.style.cursor = "grab";
    this.canvas.setAttribute("aria-label", `只用数字 ${config.digit} 合成 ${config.target}`);
    this.lifecycle = createCanvasLifecycle({
      canvas,
      events: [
        { type: "pointerdown", listener: this.handlePointerDown },
        { type: "pointermove", listener: this.handlePointerMove },
        { type: "pointerup", listener: this.handlePointerUp },
        { type: "pointercancel", listener: this.handlePointerCancel },
      ],
      onResize: this.handleResize,
      onDeactivate: () => {
        if (this.dragPointerId != null) this.releasePointer(this.dragPointerId);
        this.dragging = null;
        this.dragPointerId = null;
        this.canvas.style.cursor = "grab";
      },
    });
  }

  setActive(active) {
    this.lifecycle.setActive(active);
  }

  destroy() {
    this.lifecycle.destroy();
    this.canvas.style.removeProperty("cursor");
  }

  resetState() {
    this.nextTileId = 0;
    this.tiles = Array.from({ length: this.config.numberCount }, () =>
      this.createTile(this.config.digit, String(this.config.digit)),
    );
    this.pending = new Map();
    this.history = [];
    this.dragging = null;
    this.dragPointerId = null;
    this.message = "";
    this.messageKind = "neutral";
  }

  createTile(value, expression) {
    const tile = { id: this.nextTileId, value, expression };
    this.nextTileId += 1;
    return tile;
  }

  onPointerDown(event) {
    if (this.solved) return;
    const point = this.eventPoint(event);
    const actionRegion = this.actionRegions.find((region) => pointInRect(point, region));
    if (actionRegion && !actionRegion.disabled) {
      event.preventDefault();
      this.activateAction(actionRegion.action);
      return;
    }

    const tileRegion = [...this.tileRegions]
      .reverse()
      .find((region) => pointInRect(point, region));
    if (!tileRegion) return;

    event.preventDefault();
    this.dragging = { tileId: tileRegion.tileId, x: point.x, y: point.y };
    this.dragPointerId = event.pointerId;
    this.canvas.setPointerCapture?.(event.pointerId);
    this.canvas.style.cursor = "grabbing";
    this.draw();
  }

  onPointerMove(event) {
    if (!this.dragging || event.pointerId !== this.dragPointerId) return;
    event.preventDefault();
    const point = this.eventPoint(event);
    this.dragging.x = point.x;
    this.dragging.y = point.y;
    this.draw();
  }

  onPointerUp(event) {
    if (!this.dragging || event.pointerId !== this.dragPointerId) return;
    event.preventDefault();
    const point = this.eventPoint(event);
    const tileId = this.dragging.tileId;
    const operatorRegion = this.operatorRegions.find((region) => pointInRect(point, region));
    this.releasePointer(event.pointerId);
    this.dragging = null;
    this.dragPointerId = null;
    this.canvas.style.cursor = "grab";
    if (operatorRegion) this.dropOnOperator(tileId, operatorRegion.operatorId);
    else this.draw();
  }

  cancelDrag() {
    this.dragging = null;
    this.dragPointerId = null;
    this.canvas.style.cursor = "grab";
    this.draw();
  }

  releasePointer(pointerId) {
    if (this.canvas.hasPointerCapture?.(pointerId)) {
      this.canvas.releasePointerCapture(pointerId);
    }
  }

  eventPoint(event) {
    return canvasPointFromEvent(
      this.canvas,
      event,
      this.config.width,
      this.config.height,
    );
  }

  activateAction(action) {
    if (action === "undo") {
      const snapshot = this.history.pop();
      if (snapshot) this.restoreSnapshot(snapshot);
    } else if (action === "reset") {
      this.resetState();
    }
    this.draw();
  }

  dropOnOperator(tileId, operatorId) {
    const tileIndex = this.tiles.findIndex((tile) => tile.id === tileId);
    const operator = OPERATORS.find((candidate) => candidate.id === operatorId);
    if (tileIndex < 0 || !operator) {
      this.draw();
      return;
    }
    const tile = this.tiles[tileIndex];

    if (operator.arity === 2 && !this.pending.has(operator.id)) {
      this.saveSnapshot();
      this.tiles.splice(tileIndex, 1);
      this.pending.set(operator.id, tile);
      this.message = "";
      this.messageKind = "neutral";
      this.draw();
      return;
    }

    const left = operator.arity === 2 ? this.pending.get(operator.id) : null;
    let result;
    try {
      result = operator.arity === 1
        ? operator.apply(tile.value)
        : operator.apply(left.value, tile.value);
      assertValue(result);
    } catch (error) {
      this.message = error instanceof Error ? error.message : "这个运算无法进行";
      this.messageKind = "error";
      this.draw();
      return;
    }

    this.saveSnapshot();
    this.tiles.splice(tileIndex, 1);
    if (left) this.pending.delete(operator.id);
    const expression = operator.arity === 1
      ? unaryExpression(operator.id, tile.expression)
      : `(${left.expression} ${operator.symbol} ${tile.expression})`;
    this.tiles.push(this.createTile(result, expression));
    this.message = "";
    this.messageKind = "neutral";
    this.checkResult();
    this.draw();
  }

  saveSnapshot() {
    this.history.push({
      tiles: this.tiles.map((tile) => ({ ...tile })),
      pending: [...this.pending].map(([id, tile]) => [id, { ...tile }]),
      nextTileId: this.nextTileId,
      message: this.message,
      messageKind: this.messageKind,
    });
  }

  restoreSnapshot(snapshot) {
    this.tiles = snapshot.tiles.map((tile) => ({ ...tile }));
    this.pending = new Map(snapshot.pending.map(([id, tile]) => [id, { ...tile }]));
    this.nextTileId = snapshot.nextTileId;
    this.message = snapshot.message;
    this.messageKind = snapshot.messageKind;
  }

  checkResult() {
    if (this.tiles.length !== 1 || this.pending.size !== 0) return;
    const finalTile = this.tiles[0];
    if (Math.abs(finalTile.value - this.config.target) <= 1e-9) {
      this.solved = true;
      this.message = "";
      this.messageKind = "success";
      this.onSolved();
    } else {
      this.message = "";
      this.messageKind = "neutral";
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.config.width, this.config.height);
    ctx.fillStyle = "#f7f9fb";
    ctx.fillRect(0, 0, this.config.width, this.config.height);
    this.tileRegions = [];
    this.operatorRegions = [];
    this.actionRegions = [];

    this.drawWorkspace();
    this.drawOperators();
    this.drawActions();
    if (this.dragging) this.drawDraggedTile();
  }

  drawWorkspace() {
    const ctx = this.ctx;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = this.solved ? "#68ad89" : "#cbd2da";
    ctx.lineWidth = this.solved ? 2 : 1.5;
    roundedRect(ctx, 34, 28, 832, 186, 7);
    ctx.fill();
    ctx.stroke();

    const visibleTiles = this.tiles.filter((tile) => tile.id !== this.dragging?.tileId);
    if (visibleTiles.length === 0) return;

    const tileWidth = 100;
    const tileHeight = 64;
    const gap = 16;
    const totalWidth = visibleTiles.length * tileWidth + (visibleTiles.length - 1) * gap;
    const startX = (this.config.width - totalWidth) / 2;
    visibleTiles.forEach((tile, index) => {
      const x = startX + index * (tileWidth + gap);
      const y = 89;
      this.drawTile(tile, x, y, tileWidth, tileHeight, false);
      this.tileRegions.push({ x, y, width: tileWidth, height: tileHeight, tileId: tile.id });
    });
  }

  drawOperators() {
    const width = 128;
    const height = 104;
    const gap = 10;
    OPERATORS.forEach((operator, index) => {
      const x = 34 + index * (width + gap);
      const y = 238;
      const region = { x, y, width, height, operatorId: operator.id };
      const highlighted = this.dragging && pointInRect(this.dragging, region);
      this.drawOperator(operator, region, highlighted);
      this.operatorRegions.push(region);
    });
  }

  drawOperator(operator, region, highlighted) {
    const ctx = this.ctx;
    const pending = this.pending.get(operator.id);
    ctx.fillStyle = highlighted ? "#e8f0ff" : pending ? "#fff8e8" : "#ffffff";
    ctx.strokeStyle = highlighted ? "#2457c5" : pending ? "#c18a22" : "#c5ccd5";
    ctx.lineWidth = highlighted ? 2.5 : 1.5;
    roundedRect(ctx, region.x, region.y, region.width, region.height, 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#20242a";
    ctx.font = "700 30px ui-monospace, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(operator.symbol, region.x + region.width / 2, region.y + (pending ? 34 : 52));

    if (pending) {
      ctx.fillStyle = "#805b13";
      ctx.font = "600 13px system-ui, sans-serif";
      ctx.fillText(
        `${formatValue(pending.value)} ${operator.symbol} □`,
        region.x + region.width / 2,
        region.y + 76,
      );
    }
  }

  drawActions() {
    this.drawActionButton(34, 378, 52, 44, "↶", "undo", this.history.length === 0);
    this.drawActionButton(98, 378, 52, 44, "⟳", "reset", false);

    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(174, 372, 692, 58);
    ctx.clip();
    ctx.fillStyle = this.messageKind === "success"
      ? "#16794c"
      : this.messageKind === "error"
        ? "#b33c32"
        : "#666b73";
    ctx.font = `600 ${this.message.length > 55 ? 13 : 15}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(this.message, 174, 400);
    ctx.restore();
  }

  drawActionButton(x, y, width, height, label, action, disabled) {
    const ctx = this.ctx;
    ctx.fillStyle = disabled ? "#edf0f3" : "#ffffff";
    ctx.strokeStyle = "#c5ccd5";
    ctx.lineWidth = 1.5;
    roundedRect(ctx, x, y, width, height, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = disabled ? "#a2a8b0" : "#252b33";
    ctx.font = "600 15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + width / 2, y + height / 2);
    this.actionRegions.push({ x, y, width, height, action, disabled });
  }

  drawTile(tile, x, y, width, height, elevated) {
    const ctx = this.ctx;
    ctx.save();
    if (elevated) {
      ctx.shadowColor = "rgba(24, 35, 50, 0.24)";
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 5;
    }
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#71849b";
    ctx.lineWidth = 2;
    roundedRect(ctx, x, y, width, height, 7);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const text = formatValue(tile.value);
    ctx.fillStyle = "#171717";
    ctx.font = `700 ${text.length > 8 ? 19 : text.length > 5 ? 23 : 28}px ui-monospace, Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + width / 2, y + height / 2);
  }

  drawDraggedTile() {
    const tile = this.tiles.find((candidate) => candidate.id === this.dragging.tileId);
    if (!tile) return;
    this.drawTile(tile, this.dragging.x - 50, this.dragging.y - 32, 100, 64, true);
  }
}

function divide(left, right) {
  if (Math.abs(right) < 1e-12) throw new Error("不能除以零");
  return left / right;
}

function squareRoot(value) {
  if (value < 0) throw new Error("负数不能开平方根");
  return Math.sqrt(value);
}

function factorial(value) {
  if (!Number.isInteger(value) || value < 0 || value > 10) {
    throw new Error("阶乘只接受 0 到 10 的整数");
  }
  let result = 1;
  for (let factor = 2; factor <= value; factor += 1) result *= factor;
  return result;
}

function assertValue(value) {
  if (!Number.isFinite(value) || Math.abs(value) > 1e12) {
    throw new Error("运算结果超出本关范围");
  }
}

function unaryExpression(operatorId, expression) {
  return operatorId === "sqrt" ? `√(${expression})` : `(${expression})!`;
}

function formatValue(value) {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(6)));
}
