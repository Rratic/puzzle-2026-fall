import { actionsBlock, canvasBlock, textBlock } from "../level-blocks.js";
import { createHyperbolicController } from "./controller.js";
import { VIEWPORT } from "./layout.js";

const hyperbolicLevel = {
  id: "hyperbolic",
  blocks: [
    textBlock(new URL("./content/intro.md", import.meta.url), {
      kicker: true,
      title: "双曲空间",
    }),
    canvasBlock({
      title: "寻找双曲圆心",
      caption: "点击相邻的地砖进行移动。",
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      accessibility: { role: "application", focusable: false },
      createController: createHyperbolicController,
    }),
    textBlock(new URL("./content/complete.md", import.meta.url)),
    actionsBlock([{ label: "进入新房间", target: "compass" }]),
  ],
};

export default hyperbolicLevel;
