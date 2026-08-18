import {
  canvasPointFromEvent,
  createCanvasLifecycle,
  pointInRect,
  resizeCanvasBuffer,
  roundedRect,
} from "../canvas-utils.js";

const VIEW = {
  left: 62,
  right: 890,
  top: 160,
  bottom: 742,
  xMin: -2.15,
  xMax: 2.15,
  yMin: -1.25,
  yMax: 4.35,
};

export function createConicController(options) {
  return new ConicController(options);
}

class ConicController {
  constructor({ config, canvas, onSolved }) {
    this.config = config;
    this.canvas = canvas;
    this.onSolved = onSolved;
    this.ctx = canvas.getContext("2d");
    this.coefficients = [Array(6).fill(0), Array(6).fill(0)];
    this.solved = false;
    this.regions = [];
    this.compactLayout = false;
    this.intersectionHitRadius = 15;
    this.handleResize = () => {
      const bufferChanged = resizeCanvasBuffer(
        canvas,
        this.ctx,
        config.width,
        config.height,
      );
      const layoutChanged = this.updateResponsiveLayout();
      if (bufferChanged || layoutChanged) this.draw();
    };
    this.handlePointerDown = (event) => this.onPointerDown(event);

    this.lifecycle = createCanvasLifecycle({
      canvas,
      events: [{ type: "pointerdown", listener: this.handlePointerDown }],
      onResize: this.handleResize,
    });
  }

  setActive(active) {
    this.lifecycle.setActive(active);
  }

  destroy() {
    this.lifecycle.destroy();
  }

  onPointerDown(event) {
    event.preventDefault();
    const point = canvasPointFromEvent(
      this.canvas,
      event,
      this.config.width,
      this.config.height,
    );
    const region = this.regions.find((candidate) => pointInRect(point, candidate));
    if (region && !this.solved) {
      if (region.type === "delta") {
        this.coefficients[region.equation][region.coefficient] += region.amount;
      } else if (region.type === "clear") {
        this.coefficients.forEach((row) => row.fill(0));
      }
      this.draw();
      return;
    }

    if (!this.solved && this.hasTwoCurves()) {
      const selected = conicIntersections(...this.coefficients).find((entry) => {
        const screen = worldToScreen(entry.x, entry.y);
        return Math.hypot(screen.x - point.x, screen.y - point.y) <=
          this.intersectionHitRadius;
      });
      if (selected) {
        this.checkIntersection(selected);
      }
    }
  }

  checkIntersection(point) {
    if (Math.abs(point.x - this.config.targetX) < 1e-7) {
      this.solved = true;
      this.onSolved();
    }
    this.draw();
  }

  hasTwoCurves() {
    return this.coefficients.every((row) => row.some((value) => value !== 0));
  }

  updateResponsiveLayout() {
    const displayWidth = this.canvas.getBoundingClientRect().width || this.config.width;
    const wasCompact = this.compactLayout;
    this.compactLayout = displayWidth < 760;
    this.intersectionHitRadius = this.compactLayout ? 24 : 15;
    VIEW.top = this.compactLayout ? 342 : 160;
    VIEW.bottom = this.config.height - 18;
    return wasCompact !== this.compactLayout;
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.config.width, this.config.height);
    ctx.fillStyle = "#fbfcfe";
    ctx.fillRect(0, 0, this.config.width, this.config.height);
    this.regions = [];
    this.drawEquationEditor();
    this.drawGrid();
    if (this.coefficients[0].some((value) => value !== 0)) {
      this.drawConic(this.coefficients[0], "#2457c5");
    }
    if (this.coefficients[1].some((value) => value !== 0)) {
      this.drawConic(this.coefficients[1], "#c55232");
    }
    if (this.hasTwoCurves()) {
      this.drawIntersections();
    }
    this.canvas.setAttribute(
      "aria-label",
      `${this.config.title}，两行一般二次曲线的十二个整数系数均可用加减按钮调整`,
    );
  }

  drawEquationEditor() {
    const ctx = this.ctx;
    ctx.fillStyle = "#27313d";
    ctx.font = "600 14px ui-monospace, Consolas, monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText("Ax² + Bxy + Cy² + Dx + Ey + F = 0", 20, 20);

    if (this.compactLayout) {
      this.compactCoefficientGroup(0, 52, "I", "#2457c5");
      this.compactCoefficientGroup(1, 190, "II", "#c55232");
      this.clearButton(830, 8, 108, 36);
    } else {
      this.coefficientRow(0, 42, "I", "#2457c5");
      this.coefficientRow(1, 96, "II", "#c55232");
      this.clearButton(850, 8, 88, 30);
    }
  }

  compactCoefficientGroup(equation, y, label, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.font = "700 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, 25, y + 63);
    ["A", "B", "C", "D", "E", "F"].forEach((name, index) => {
      const row = Math.floor(index / 3);
      const column = index % 3;
      this.compactStepper(
        equation,
        index,
        48 + column * 296,
        y + row * 68,
        name,
        color,
      );
    });
  }

  compactStepper(equation, coefficient, x, y, name, color) {
    const ctx = this.ctx;
    ctx.fillStyle = "#59616c";
    ctx.font = "700 15px ui-monospace, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.fillText(name, x + 8, y + 29);

    this.deltaButton(equation, coefficient, -1, x + 24, y, "−", color, 58, 58);
    ctx.fillStyle = "#f6f8fa";
    ctx.strokeStyle = "#c7ced7";
    ctx.lineWidth = 1;
    roundedRect(ctx, x + 90, y, 62, 58, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#18202a";
    ctx.font = "700 18px ui-monospace, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(this.coefficients[equation][coefficient]), x + 121, y + 29);
    this.deltaButton(equation, coefficient, 1, x + 160, y, "+", color, 58, 58);
  }

  coefficientRow(equation, y, label, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.font = "700 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, 25, y + 18);
    ["A", "B", "C", "D", "E", "F"].forEach((name, index) => {
      this.stepper(equation, index, 48 + index * 148, y, name, color);
    });
  }

  stepper(equation, coefficient, x, y, name, color) {
    const ctx = this.ctx;
    ctx.fillStyle = "#59616c";
    ctx.font = "700 12px ui-monospace, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.fillText(name, x + 7, y + 18);

    this.deltaButton(equation, coefficient, -1, x + 20, y, "−", color);
    ctx.fillStyle = "#f6f8fa";
    ctx.strokeStyle = "#c7ced7";
    ctx.lineWidth = 1;
    roundedRect(ctx, x + 53, y, 46, 36, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#18202a";
    ctx.font = "700 15px ui-monospace, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(this.coefficients[equation][coefficient]), x + 76, y + 18);
    this.deltaButton(equation, coefficient, 1, x + 102, y, "+", color);
  }

  deltaButton(equation, coefficient, amount, x, y, label, color, width = 30, height = 36) {
    const ctx = this.ctx;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.25;
    roundedRect(ctx, x, y, width, height, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = "600 17px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + width / 2, y + height / 2);
    this.regions.push({
      x,
      y,
      width,
      height,
      type: "delta",
      equation,
      coefficient,
      amount,
    });
  }

  clearButton(x, y, width, height) {
    const ctx = this.ctx;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#aeb7c2";
    ctx.lineWidth = 1;
    roundedRect(ctx, x, y, width, height, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#27313d";
    ctx.font = "600 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("清零", x + width / 2, y + height / 2);
    this.regions.push({ x, y, width, height, type: "clear" });
  }

  drawGrid() {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(VIEW.left, VIEW.top, VIEW.right - VIEW.left, VIEW.bottom - VIEW.top);
    ctx.clip();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(VIEW.left, VIEW.top, VIEW.right - VIEW.left, VIEW.bottom - VIEW.top);
    ctx.strokeStyle = "#e4e8ed";
    ctx.lineWidth = 1;
    for (let x = Math.ceil(VIEW.xMin * 2) / 2; x <= VIEW.xMax; x += 0.5) {
      const screen = worldToScreen(x, 0);
      ctx.beginPath();
      ctx.moveTo(screen.x, VIEW.top);
      ctx.lineTo(screen.x, VIEW.bottom);
      ctx.stroke();
    }
    for (let y = Math.ceil(VIEW.yMin * 2) / 2; y <= VIEW.yMax; y += 0.5) {
      const screen = worldToScreen(0, y);
      ctx.beginPath();
      ctx.moveTo(VIEW.left, screen.y);
      ctx.lineTo(VIEW.right, screen.y);
      ctx.stroke();
    }
    const origin = worldToScreen(0, 0);
    ctx.strokeStyle = "#7e8792";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(VIEW.left, origin.y);
    ctx.lineTo(VIEW.right, origin.y);
    ctx.moveTo(origin.x, VIEW.top);
    ctx.lineTo(origin.x, VIEW.bottom);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = "#ccd3dc";
    ctx.strokeRect(VIEW.left, VIEW.top, VIEW.right - VIEW.left, VIEW.bottom - VIEW.top);
  }

  drawConic(coefficients, color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(VIEW.left, VIEW.top, VIEW.right - VIEW.left, VIEW.bottom - VIEW.top);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    contourSegments(coefficients).forEach(([from, to]) => {
      const screenFrom = worldToScreen(from.x, from.y);
      const screenTo = worldToScreen(to.x, to.y);
      ctx.beginPath();
      ctx.moveTo(screenFrom.x, screenFrom.y);
      ctx.lineTo(screenTo.x, screenTo.y);
      ctx.stroke();
    });
    ctx.restore();
  }

  drawIntersections() {
    const ctx = this.ctx;
    conicIntersections(...this.coefficients).forEach((entry) => {
      const point = worldToScreen(entry.x, entry.y);
      ctx.fillStyle = this.solved && Math.abs(entry.x - this.config.targetX) < 0.02
        ? "#16794c"
        : "#ffffff";
      ctx.strokeStyle = "#171717";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }
}

function equationsEquivalent(values, expected) {
  if (!values || values.length !== expected.length) {
    return false;
  }
  const pivot = expected.findIndex((value) => value !== 0);
  if (pivot < 0 || values[pivot] === 0) {
    return false;
  }
  const scale = values[pivot] / expected[pivot];
  return expected.every((value, index) => values[index] === value * scale);
}

function conicValue(coefficients, x, y) {
  const [a, b, c, d, e, f] = coefficients;
  return a * x * x + b * x * y + c * y * y + d * x + e * y + f;
}

function conicGradient(coefficients, x, y) {
  const [a, b, c, d, e] = coefficients;
  return {
    x: 2 * a * x + b * y + d,
    y: b * x + 2 * c * y + e,
  };
}

function contourSegments(coefficients) {
  const columns = 120;
  const rows = 90;
  const stepX = (VIEW.xMax - VIEW.xMin) / columns;
  const stepY = (VIEW.yMax - VIEW.yMin) / rows;
  const segments = [];

  for (let row = 0; row < rows; row += 1) {
    const y0 = VIEW.yMin + row * stepY;
    const y1 = y0 + stepY;
    for (let column = 0; column < columns; column += 1) {
      const x0 = VIEW.xMin + column * stepX;
      const x1 = x0 + stepX;
      const corners = [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ].map((point) => ({ ...point, value: conicValue(coefficients, point.x, point.y) }));
      const hits = [];
      [[0, 1], [1, 2], [2, 3], [3, 0]].forEach(([first, second]) => {
        const hit = zeroOnEdge(corners[first], corners[second]);
        if (hit && !hits.some((entry) => Math.hypot(entry.x - hit.x, entry.y - hit.y) < 1e-8)) {
          hits.push(hit);
        }
      });
      if (hits.length === 2) {
        segments.push([hits[0], hits[1]]);
      } else if (hits.length === 4) {
        segments.push([hits[0], hits[1]], [hits[2], hits[3]]);
      }
    }
  }
  return segments;
}

function zeroOnEdge(first, second) {
  const firstZero = Math.abs(first.value) < 1e-12;
  const secondZero = Math.abs(second.value) < 1e-12;
  if (firstZero && secondZero) {
    return null;
  }
  if (!firstZero && !secondZero && Math.sign(first.value) === Math.sign(second.value)) {
    return null;
  }
  const denominator = first.value - second.value;
  const ratio = Math.abs(denominator) < 1e-14 ? 0 : first.value / denominator;
  return {
    x: first.x + (second.x - first.x) * ratio,
    y: first.y + (second.y - first.y) * ratio,
  };
}

function conicIntersections(first, second) {
  const intersections = [];
  const seedColumns = 18;
  const seedRows = 18;
  const coefficientScale = Math.max(
    1,
    ...first.map(Math.abs),
    ...second.map(Math.abs),
  );

  for (let row = 0; row <= seedRows; row += 1) {
    for (let column = 0; column <= seedColumns; column += 1) {
      let x = VIEW.xMin + (column / seedColumns) * (VIEW.xMax - VIEW.xMin);
      let y = VIEW.yMin + (row / seedRows) * (VIEW.yMax - VIEW.yMin);
      let converged = false;

      for (let iteration = 0; iteration < 35; iteration += 1) {
        const firstValue = conicValue(first, x, y);
        const secondValue = conicValue(second, x, y);
        const firstGradient = conicGradient(first, x, y);
        const secondGradient = conicGradient(second, x, y);
        const determinant =
          firstGradient.x * secondGradient.y -
          firstGradient.y * secondGradient.x;
        if (Math.abs(determinant) < 1e-10) {
          break;
        }
        const deltaX =
          (firstValue * secondGradient.y - secondValue * firstGradient.y) /
          determinant;
        const deltaY =
          (firstGradient.x * secondValue - secondGradient.x * firstValue) /
          determinant;
        x -= deltaX;
        y -= deltaY;
        if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(deltaX) + Math.abs(deltaY) > 20) {
          break;
        }
        if (Math.abs(deltaX) + Math.abs(deltaY) < 1e-9) {
          converged = true;
          break;
        }
      }

      if (
        converged &&
        x >= VIEW.xMin &&
        x <= VIEW.xMax &&
        y >= VIEW.yMin &&
        y <= VIEW.yMax &&
        Math.abs(conicValue(first, x, y)) < 1e-7 * coefficientScale &&
        Math.abs(conicValue(second, x, y)) < 1e-7 * coefficientScale &&
        !intersections.some((entry) => Math.hypot(entry.x - x, entry.y - y) < 0.01)
      ) {
        intersections.push({ x, y });
      }
    }
  }
  return intersections.sort((left, right) => left.x - right.x || left.y - right.y);
}

function worldToScreen(x, y) {
  return {
    x: VIEW.left + ((x - VIEW.xMin) / (VIEW.xMax - VIEW.xMin)) * (VIEW.right - VIEW.left),
    y: VIEW.bottom - ((y - VIEW.yMin) / (VIEW.yMax - VIEW.yMin)) * (VIEW.bottom - VIEW.top),
  };
}
