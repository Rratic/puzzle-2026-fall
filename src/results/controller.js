import {
  formatDuration,
  getProgressSummary,
} from "../progress.js";

const STAMP_URL = new URL("../../assets/stamp.png", import.meta.url);
let stampImagePromise = null;

export function createResultsController({ mount }) {
  return new ResultsController(mount);
}

class ResultsController {
  constructor(mount) {
    this.mount = mount;
    this.summary = getProgressSummary();
    this.handleImage = () => void this.generateImage();
    this.handlePdf = () => void this.generatePdf();
    this.build();
  }

  build() {
    this.mount.classList.add("results-view");
    const header = element("header", "results-header");
    const title = element("h1", "results-title", "行动结算");
    const status = element(
      "p",
      "results-status",
      this.summary.allCompleted
        ? "全部谜题已经完成。"
        : this.summary.cleared
          ? "已通关一条路线，可继续补完其余谜题。"
          : "尚未完成一条路线。",
    );
    header.append(title, status);

    const metrics = element("div", "results-metrics");
    metrics.append(
      metric("通关时长", this.summary.clearMs == null ? "--" : formatDuration(this.summary.clearMs)),
      metric("全部完成时长", this.summary.allMs == null ? "--" : formatDuration(this.summary.allMs)),
      metric("完成进度", `${this.summary.completedCount}/${this.summary.levels.length}`),
    );

    const list = element("div", "results-levels");
    this.summary.levels.forEach((level) => {
      const row = element("div", "results-level-row");
      const name = element("span", "results-level-name", level.label);
      const levelStatus = element(
        "span",
        `results-level-status ${level.completed ? "is-complete" : "is-incomplete"}`,
        level.completed ? "已完成" : "未完成",
      );
      const duration = element(
        "span",
        "results-level-time",
        level.completed ? formatDuration(level.durationMs) : "--",
      );
      row.append(name, levelStatus, duration);
      if (!level.completed && level.available && this.summary.cleared) {
        const link = element("a", "results-level-link", "前往");
        link.href = `#${encodeURIComponent(level.id)}`;
        row.append(link);
      }
      list.append(row);
    });

    const exportSection = element("section", "results-export");
    const exportTitle = element("h2", "results-section-title", "生成记录");
    const label = element("label", "results-nickname-label", "昵称");
    this.input = element("input", "results-nickname-input");
    this.input.type = "text";
    this.input.maxLength = 32;
    this.input.autocomplete = "nickname";
    this.input.placeholder = "填写昵称";
    label.append(this.input);
    const actions = element("div", "results-export-actions");
    this.imageButton = element("button", "results-export-button", "生成图片");
    this.imageButton.type = "button";
    this.pdfButton = element("button", "results-export-button is-secondary", "生成证书 PDF");
    this.pdfButton.type = "button";
    this.imageButton.disabled = !this.summary.cleared;
    this.pdfButton.disabled = !this.summary.cleared;
    this.feedback = element("div", "results-feedback");
    this.feedback.setAttribute("aria-live", "polite");
    actions.append(this.imageButton, this.pdfButton);
    exportSection.append(exportTitle, label, actions, this.feedback);

    this.mount.append(header, metrics, list, exportSection);
    this.imageButton.addEventListener("click", this.handleImage);
    this.pdfButton.addEventListener("click", this.handlePdf);
  }

  destroy() {
    this.imageButton.removeEventListener("click", this.handleImage);
    this.pdfButton.removeEventListener("click", this.handlePdf);
  }

  nickname() {
    const nickname = this.input.value.trim();
    if (!nickname) {
      this.showFeedback("请先填写昵称。", true);
      this.input.focus();
      return null;
    }
    return nickname;
  }

  async generateImage() {
    const nickname = this.nickname();
    if (!nickname) return;
    this.setBusy(true);
    try {
      const canvas = await drawResultImage(this.summary, nickname);
      const blob = await canvasBlob(canvas, "image/png");
      downloadBlob(blob, `${safeFilename(nickname)}-行动结算.png`);
      this.showFeedback("图片已生成。", false);
    } catch (error) {
      console.error(error);
      this.showFeedback("图片生成失败。", true);
    } finally {
      this.setBusy(false);
    }
  }

  async generatePdf() {
    const nickname = this.nickname();
    if (!nickname) return;
    this.setBusy(true);
    try {
      const certificate = await drawCertificate(this.summary, nickname);
      const jpeg = await canvasBlob(certificate, "image/jpeg", 0.94);
      const pdf = createImagePdf(
        new Uint8Array(await jpeg.arrayBuffer()),
        certificate.width,
        certificate.height,
      );
      downloadBlob(pdf, `${safeFilename(nickname)}-通关证书.pdf`);
      this.showFeedback("证书 PDF 已生成。", false);
    } catch (error) {
      console.error(error);
      this.showFeedback("证书生成失败。", true);
    } finally {
      this.setBusy(false);
    }
  }

  setBusy(busy) {
    this.imageButton.disabled = busy || !this.summary.cleared;
    this.pdfButton.disabled = busy || !this.summary.cleared;
  }

  showFeedback(message, isError) {
    this.feedback.textContent = message;
    this.feedback.classList.toggle("is-error", isError);
  }
}

async function drawResultImage(summary, nickname) {
  const stamp = await loadStampImage();
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 675;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f7f8f5";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#202725";
  ctx.fillRect(0, 0, 28, canvas.height);
  ctx.fillStyle = "#2f7278";
  ctx.fillRect(28, 0, 10, canvas.height);

  ctx.fillStyle = "#2f7278";
  ctx.font = "700 24px system-ui, sans-serif";
  ctx.fillText("识数鸡寻踪", 94, 94);
  ctx.fillStyle = "#171717";
  ctx.font = "700 58px system-ui, sans-serif";
  ctx.fillText(summary.allCompleted ? "全部完成记录" : "通关记录", 92, 174);
  ctx.font = "600 32px system-ui, sans-serif";
  drawFittedText(ctx, nickname, 92, 235, 840, 32);

  ctx.strokeStyle = "#cfd6d2";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(92, 284);
  ctx.lineTo(1108, 284);
  ctx.stroke();

  drawImageMetric(
    ctx,
    "通关时长（最短路线）",
    summary.clearMs == null ? "--" : formatDuration(summary.clearMs),
    92,
    354,
  );
  drawImageMetric(
    ctx,
    "全部完成时长",
    summary.allMs == null ? "--" : formatDuration(summary.allMs),
    92,
    477,
  );
  drawImageMetric(
    ctx,
    "完成进度",
    `${summary.completedCount}/${summary.levels.length}`,
    690,
    354,
  );
  ctx.drawImage(stamp, 950, 430, 200, 200);

  return canvas;
}

function drawImageMetric(ctx, label, value, x, y) {
  ctx.fillStyle = "#66706d";
  ctx.font = "600 20px system-ui, sans-serif";
  ctx.fillText(label, x, y);
  ctx.fillStyle = "#202725";
  ctx.font = "700 40px ui-monospace, Consolas, monospace";
  ctx.fillText(value, x, y + 52);
}

async function drawCertificate(summary, nickname) {
  const stamp = await loadStampImage();
  const canvas = document.createElement("canvas");
  canvas.width = 1684;
  canvas.height = 1190;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fbfbf7";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#202725";
  ctx.lineWidth = 10;
  ctx.strokeRect(46, 46, canvas.width - 92, canvas.height - 92);
  ctx.strokeStyle = "#b98b20";
  ctx.lineWidth = 3;
  ctx.strokeRect(68, 68, canvas.width - 136, canvas.height - 136);
  drawCertificateCorners(ctx, canvas.width, canvas.height);
  drawCertificateRule(ctx, 180, canvas.width - 180, 286);

  const mainColumnX = 180;
  const dividerX = 1000;
  ctx.textAlign = "left";
  ctx.fillStyle = "#2f7278";
  ctx.font = "700 34px system-ui, sans-serif";
  ctx.fillText("识数鸡寻踪", mainColumnX, 220);

  ctx.fillStyle = "#96546a";
  drawFittedText(ctx, nickname, mainColumnX, 500, 700, 72);
  ctx.strokeStyle = "#d6bd75";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(mainColumnX, 540);
  ctx.lineTo(860, 540);
  ctx.stroke();

  ctx.fillStyle = "#202725";
  ctx.font = "700 62px system-ui, sans-serif";
  ctx.fillText(summary.allCompleted ? "全部完成" : "已通关", mainColumnX, 680);
  drawCertificateRule(ctx, mainColumnX, 860, 750, 520);

  ctx.strokeStyle = "#d6bd75";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(dividerX, 360);
  ctx.lineTo(dividerX, 850);
  ctx.stroke();

  drawStampBacking(ctx, 1280, 620);
  ctx.drawImage(stamp, 1180, 520, 200, 200);
  return canvas;
}

function drawCertificateCorners(ctx, width, height) {
  const inset = 112;
  const length = 52;
  const color = "#b98b20";
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  for (const [x, y, directionX, directionY] of [
    [inset, inset, 1, 1],
    [width - inset, inset, -1, 1],
    [inset, height - inset, 1, -1],
    [width - inset, height - inset, -1, -1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, y + directionY * length);
    ctx.lineTo(x, y);
    ctx.lineTo(x + directionX * length, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + directionX * 10, y + directionY * 10, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCertificateRule(ctx, startX, endX, y, diamondX = (startX + endX) / 2) {
  ctx.save();
  ctx.strokeStyle = "#b98b20";
  ctx.fillStyle = "#b98b20";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(startX, y);
  ctx.lineTo(diamondX - 24, y);
  ctx.moveTo(diamondX + 24, y);
  ctx.lineTo(endX, y);
  ctx.stroke();
  ctx.translate(diamondX, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-8, -8, 16, 16);
  ctx.restore();
}

function drawStampBacking(ctx, centerX, centerY) {
  ctx.save();
  ctx.strokeStyle = "#b98b20";
  ctx.lineWidth = 4;
  ctx.setLineDash([5, 9]);
  ctx.beginPath();
  ctx.arc(centerX, centerY, 112, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 106, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function loadStampImage() {
  if (!stampImagePromise) {
    stampImagePromise = new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image), { once: true });
      image.addEventListener("error", () => reject(new Error("印章图片加载失败。")), {
        once: true,
      });
      image.src = STAMP_URL.href;
    });
  }
  return stampImagePromise;
}

function createImagePdf(jpegBytes, imageWidth, imageHeight) {
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = Array(6).fill(0);
  let length = 0;
  const append = (value) => {
    const bytes = typeof value === "string" ? encoder.encode(value) : value;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (number, body) => {
    offsets[number] = length;
    append(`${number} 0 obj\n${body}\nendobj\n`);
  };

  append("%PDF-1.4\n%PDFIMAGE\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(
    3,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] " +
      "/Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>",
  );
  const content = "q\n842 0 0 595 0 0 cm\n/Im0 Do\nQ\n";
  object(4, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`);
  offsets[5] = length;
  append(
    "5 0 obj\n" +
      `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\n` +
      "stream\n",
  );
  append(jpegBytes);
  append("\nendstream\nendobj\n");

  const xrefOffset = length;
  append("xref\n0 6\n0000000000 65535 f \n");
  for (let index = 1; index <= 5; index += 1) {
    append(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  }
  append(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return new Blob(chunks, { type: "application/pdf" });
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas export returned no data."));
    }, type, quality);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function drawFittedText(ctx, text, x, y, maxWidth, initialSize, centered = false) {
  let size = initialSize;
  do {
    ctx.font = `700 ${size}px system-ui, sans-serif`;
    size -= 2;
  } while (size > 20 && ctx.measureText(text).width > maxWidth);
  const previousAlign = ctx.textAlign;
  if (centered) ctx.textAlign = "center";
  ctx.fillText(text, x, y);
  ctx.textAlign = previousAlign;
}

function safeFilename(value) {
  const safe = value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim();
  return safe || "project-111";
}

function metric(label, value) {
  const item = element("div", "results-metric");
  item.append(
    element("span", "results-metric-label", label),
    element("strong", "results-metric-value", value),
  );
  return item;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
