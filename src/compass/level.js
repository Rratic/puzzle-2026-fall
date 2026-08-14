import { actionsBlock, canvasBlock, textBlock } from "../level-blocks.js";
import { createCompassController, PUZZLES, SIZE } from "./controller.js";

function puzzle(title, config) {
  return canvasBlock({
    title,
    caption: "单击两个可见点作圆；单击交点取点；隐藏模式下单击点可隐藏；单击圆周可隐藏圆；拖动平移，滚轮缩放。",
    width: SIZE.width,
    height: SIZE.height,
    ...config,
    createController: createCompassController,
  });
}

const compassLevel = {
  id: "compass",
  blocks: [
    textBlock(new URL("./content/intro.md", import.meta.url), {
      kicker: true,
      title: "单规作图",
    }),
    textBlock(new URL("./content/transfer.md", import.meta.url)),
    puzzle("长度转移", PUZZLES.transfer),
    textBlock(new URL("./content/midpoint.md", import.meta.url)),
    puzzle("作中点", PUZZLES.midpoint),
    textBlock(new URL("./content/inversion.md", import.meta.url)),
    puzzle("点的反演", PUZZLES.inversion),
    textBlock(new URL("./content/circumcenter.md", import.meta.url)),
    puzzle("三角形外心", PUZZLES.circumcenter),
    textBlock(new URL("./content/line-line.md", import.meta.url)),
    puzzle("直线与直线交点", PUZZLES.lineLine),
    textBlock(new URL("./content/line-circle.md", import.meta.url)),
    puzzle("圆与直线交点", PUZZLES.lineCircle),
    textBlock(new URL("./content/complete.md", import.meta.url)),
    actionsBlock([{ label: "前往扭结档案室", target: "knots" }]),
  ],
};

export default compassLevel;
