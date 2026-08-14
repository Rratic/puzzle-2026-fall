import { actionsBlock, canvasBlock, textBlock } from "../level-blocks.js";
import { createConicController } from "./controller.js";

function puzzle(options) {
  return canvasBlock({
    ...options,
    width: 960,
    height: 600,
    createController: createConicController,
  });
}

const quadraticLevel = {
  id: "quadratic",
  blocks: [
    textBlock(new URL("./content/intro.md", import.meta.url), {
      kicker: true,
      title: "二次曲线作图",
    }),
    textBlock(new URL("./content/duplication.md", import.meta.url)),
    puzzle({
      title: "倍立方",
      caption: "使用 + / − 调整两行系数，再点选交点。",
      answers: [[-1, 0, 0, 0, 1, 0], [0, 1, 0, 0, 0, -2]],
      targetX: Math.cbrt(2),
    }),
    textBlock(new URL("./content/trisection.md", import.meta.url)),
    puzzle({
      title: "三等分 60°",
      caption: "使用 + / − 调整两行系数，再点选交点。",
      answers: [[-1, 0, 0, 0, 1, 0], [0, 8, 0, -6, 0, -1]],
      targetX: Math.cos(Math.PI / 9),
    }),
    textBlock(new URL("./content/complete.md", import.meta.url)),
    actionsBlock([{ label: "前往扭结档案室", target: "knots" }]),
  ],
};

export default quadraticLevel;
