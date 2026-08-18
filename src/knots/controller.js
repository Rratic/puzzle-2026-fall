import {
  createCanvasLifecycle,
  resizeCanvasBuffer,
} from "../canvas-utils.js";
import {
  parseLaurentPolynomial,
  polynomialsEqual,
} from "./polynomial.js";

export function createPolynomialInputController(options) {
  return new PolynomialInputController(options);
}

class PolynomialInputController {
  constructor({ config, canvas, mount, onSolved }) {
    this.config = config;
    this.canvas = canvas;
    this.onSolved = onSolved;
    this.ctx = canvas.getContext("2d");
    this.question = config.question;
    this.answer = parseLaurentPolynomial(this.question.answer);
    this.solved = false;

    this.handleSubmit = (event) => this.submit(event);
    this.handleInput = () => this.clearFeedback();
    this.handleCanvasClick = () => this.input.focus({ preventScroll: true });
    this.handleResize = () => {
      if (resizeCanvasBuffer(canvas, this.ctx, config.width, config.height)) {
        this.draw();
      }
    };

    this.buildAnswerForm(mount);
    this.canvas.setAttribute("aria-label", `${this.question.name}的纽结图`);
    this.lifecycle = createCanvasLifecycle({
      canvas,
      events: [{ type: "pointerdown", listener: this.handleCanvasClick }],
      onResize: this.handleResize,
    });
  }

  buildAnswerForm(mount) {
    this.form = document.createElement("form");
    this.form.className = "polynomial-answer";

    this.input = document.createElement("input");
    this.input.className = "polynomial-input";
    this.input.type = "text";
    this.input.inputMode = "text";
    this.input.autocomplete = "off";
    this.input.autocapitalize = "off";
    this.input.spellcheck = false;
    this.input.placeholder = "参考格式：a^2z - a^(-2)*z^-1 + 9";
    this.input.setAttribute("aria-label", `${this.question.name}的 HOMFLY-PT 多项式`);

    this.submitButton = document.createElement("button");
    this.submitButton.className = "polynomial-submit";
    this.submitButton.type = "submit";
    this.submitButton.textContent = "提交";

    this.feedback = document.createElement("div");
    this.feedback.className = "polynomial-feedback";
    this.feedback.setAttribute("aria-live", "polite");

    this.form.append(this.input, this.submitButton, this.feedback);
    this.form.addEventListener("submit", this.handleSubmit);
    this.input.addEventListener("input", this.handleInput);
    mount.append(this.form);
  }

  setActive(active) {
    this.lifecycle.setActive(active);
  }

  destroy() {
    this.form.removeEventListener("submit", this.handleSubmit);
    this.input.removeEventListener("input", this.handleInput);
    this.lifecycle.destroy();
    this.form.remove();
  }

  submit(event) {
    event.preventDefault();
    if (this.solved) return;

    let candidate;
    try {
      candidate = parseLaurentPolynomial(this.input.value);
    } catch (error) {
      this.showFeedback(error instanceof Error ? error.message : "无法解析输入。", true);
      return;
    }

    if (!polynomialsEqual(candidate, this.answer)) {
      this.showFeedback("多项式不正确。", true);
      return;
    }

    this.solved = true;
    this.input.disabled = true;
    this.submitButton.disabled = true;
    this.input.removeAttribute("aria-invalid");
    this.showFeedback("答案正确。", false);
    this.onSolved();
  }

  clearFeedback() {
    if (this.solved) return;
    this.feedback.textContent = "";
    this.feedback.classList.remove("is-error", "is-success");
    this.input.removeAttribute("aria-invalid");
  }

  showFeedback(message, isError) {
    this.feedback.textContent = message;
    this.feedback.classList.toggle("is-error", isError);
    this.feedback.classList.toggle("is-success", !isError);
    if (isError) this.input.setAttribute("aria-invalid", "true");
  }

  draw() {
    const ctx = this.ctx;
    const { width, height } = this.config;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    if (this.question.diagram === "unlink") {
      drawUnlink(ctx, width / 2, height / 2, 112, this.question.accent);
    } else if (this.question.diagram === "hopf") {
      drawHopfLink(ctx, width / 2, height / 2, 172, this.question.accent);
    } else {
      drawParametricKnot(
        ctx,
        this.question.diagram,
        width / 2,
        height / 2,
        178,
        this.question.accent,
      );
    }
  }
}

function drawUnlink(ctx, centerX, centerY, radius, color) {
  const secondary = "#315b91";
  const first = ellipsePoints(centerX - 150, centerY, radius, radius, 0);
  const second = ellipsePoints(centerX + 150, centerY, radius, radius, 0);
  strokeClosedCurve(ctx, first, color, 7);
  strokeClosedCurve(ctx, second, secondary, 7);
}

function drawParametricKnot(ctx, kind, centerX, centerY, radius, color) {
  const definitions = {
    trefoil: (t) => ({
      x: Math.sin(t) + 2 * Math.sin(2 * t),
      y: Math.cos(t) - 2 * Math.cos(2 * t),
      z: -Math.sin(3 * t),
    }),
    figureEight: (t) => ({
      x: (2 + Math.cos(2 * t)) * Math.cos(3 * t),
      y: (2 + Math.cos(2 * t)) * Math.sin(3 * t),
      z: Math.sin(4 * t),
    }),
    cinquefoil: (t) => ({
      x: (2 + 0.72 * Math.cos(5 * t)) * Math.cos(2 * t),
      y: (2 + 0.72 * Math.cos(5 * t)) * Math.sin(2 * t),
      z: 0.72 * Math.sin(5 * t),
    }),
  };
  const samples = 520;
  const raw = Array.from({ length: samples }, (_, index) =>
    definitions[kind]((index / samples) * Math.PI * 2),
  );
  const extent = Math.max(...raw.flatMap((point) => [Math.abs(point.x), Math.abs(point.y)]));
  const points = raw.map((point) => ({
    x: centerX + (point.x / extent) * radius,
    y: centerY + (point.y / extent) * radius,
    z: point.z,
  }));

  strokeClosedCurve(ctx, points, color, 7);
  const crossings = findProjectedCrossings(points);
  crossings.forEach((crossing) => {
    const overIndex = crossing.firstZ > crossing.secondZ ? crossing.first : crossing.second;
    strokeCurveWindow(ctx, points, overIndex, 10, "#ffffff", 15);
    strokeCurveWindow(ctx, points, overIndex, 10, color, 7);
  });
}

function findProjectedCrossings(points) {
  const crossings = [];
  const count = points.length;
  for (let first = 0; first < count; first += 1) {
    const firstNext = (first + 1) % count;
    for (let second = first + 18; second < count; second += 1) {
      const secondNext = (second + 1) % count;
      if (Math.abs(first - second) > count - 18) continue;
      const hit = segmentIntersection(points[first], points[firstNext], points[second], points[secondNext]);
      if (!hit) continue;
      if (crossings.some((entry) => Math.hypot(entry.x - hit.x, entry.y - hit.y) < 10)) continue;
      crossings.push({
        ...hit,
        first,
        second,
        firstZ: points[first].z + (points[firstNext].z - points[first].z) * hit.firstAmount,
        secondZ: points[second].z + (points[secondNext].z - points[second].z) * hit.secondAmount,
      });
    }
  }
  return crossings;
}

function segmentIntersection(a, b, c, d) {
  const firstX = b.x - a.x;
  const firstY = b.y - a.y;
  const secondX = d.x - c.x;
  const secondY = d.y - c.y;
  const denominator = firstX * secondY - firstY * secondX;
  if (Math.abs(denominator) < 1e-7) return null;
  const offsetX = c.x - a.x;
  const offsetY = c.y - a.y;
  const firstAmount = (offsetX * secondY - offsetY * secondX) / denominator;
  const secondAmount = (offsetX * firstY - offsetY * firstX) / denominator;
  if (firstAmount <= 0.02 || firstAmount >= 0.98 || secondAmount <= 0.02 || secondAmount >= 0.98) return null;
  return {
    x: a.x + firstX * firstAmount,
    y: a.y + firstY * firstAmount,
    firstAmount,
    secondAmount,
  };
}

function strokeClosedCurve(ctx, points, color, width) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index].x, points[index].y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function strokeCurveWindow(ctx, points, center, halfWidth, color, width) {
  const count = points.length;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let offset = -halfWidth; offset <= halfWidth; offset += 1) {
    const point = points[(center + offset + count) % count];
    if (offset === -halfWidth) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawHopfLink(ctx, centerX, centerY, radius, color) {
  const secondary = "#315b91";
  const loopRadius = radius * 0.78;
  const centerOffset = loopRadius * 0.52;
  const first = ellipsePoints(centerX - centerOffset, centerY, loopRadius, loopRadius, 0);
  const second = ellipsePoints(centerX + centerOffset, centerY, loopRadius, loopRadius, 0);
  strokeClosedCurve(ctx, first, color, 7);
  strokeClosedCurve(ctx, second, secondary, 7);

  const crossings = crossingsBetween(first, second);
  crossings.forEach((crossing, index) => {
    const points = index % 2 === 0 ? first : second;
    const at = index % 2 === 0 ? crossing.first : crossing.second;
    const overColor = index % 2 === 0 ? color : secondary;
    strokeCurveWindow(ctx, points, at, 8, "#ffffff", 15);
    strokeCurveWindow(ctx, points, at, 8, overColor, 7);
  });
}

function ellipsePoints(cx, cy, rx, ry, rotation) {
  const count = 320;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const x = Math.cos(angle) * rx;
    const y = Math.sin(angle) * ry;
    return {
      x: cx + x * cosine - y * sine,
      y: cy + x * sine + y * cosine,
      z: 0,
    };
  });
}

function crossingsBetween(first, second) {
  const crossings = [];
  for (let firstIndex = 0; firstIndex < first.length; firstIndex += 1) {
    const firstNext = (firstIndex + 1) % first.length;
    for (let secondIndex = 0; secondIndex < second.length; secondIndex += 1) {
      const secondNext = (secondIndex + 1) % second.length;
      const hit = segmentIntersection(
        first[firstIndex],
        first[firstNext],
        second[secondIndex],
        second[secondNext],
      );
      if (!hit || crossings.some((entry) => Math.hypot(entry.x - hit.x, entry.y - hit.y) < 10)) continue;
      crossings.push({ ...hit, first: firstIndex, second: secondIndex });
    }
  }
  return crossings.sort((a, b) => a.y - b.y);
}
