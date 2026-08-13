import { canvasBlock, textBlock } from "../level-blocks.js";
import { createHyperRogueController, VIEWPORT } from "./controller.js";

const hyperbolicLevel = {
  id: "hyperbolic",
  blocks: [
    textBlock(new URL("./content/intro.html", import.meta.url), {
      kicker: true,
      title: "双曲圆盘",
    }),
    canvasBlock({
      title: "寻找双曲圆心",
      caption: "点击相邻七边形移动；拖动画面选择移动方向。",
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      createController: createHyperRogueController,
    }),
  ],
};

export default hyperbolicLevel;
