import { actionsBlock, canvasBlock, textBlock } from "../level-blocks.js";
import { createConicController } from "./controller.js";

function puzzle(options) {
  return canvasBlock({
    ...options,
    width: 960,
    height: 760,
    caption: "使用 + / − 调整两组系数，再点选交点。",
    accessibility: { role: "application", focusable: false },
    createController: createConicController,
  });
}

const quadraticLevel = {
  id: "quadratic",
  blocks: [
    textBlock(new URL("./content/intro.md", import.meta.url), {
      kicker: true,
      title: "控制室",
    }),
    textBlock(new URL("./content/duplication.md", import.meta.url)),
    puzzle({
      title: "倍立方",
      targetX: Math.cbrt(2),
    }),
    textBlock(new URL("./content/trisection.md", import.meta.url)),
    puzzle({
      title: "三等分 60°",
      targetX: Math.cos(Math.PI / 9),
    }),
    textBlock(new URL("./content/complete.md", import.meta.url)),
    actionsBlock([{ label: "进入新房间", target: "ritual" }]),
  ],
};

export default quadraticLevel;
