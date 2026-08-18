import { actionsBlock, canvasBlock, textBlock } from "../level-blocks.js";
import { createRitualController } from "./controller.js";

const SIZE = Object.freeze({ width: 960, height: 760 });

const ritualLevel = {
  id: "ritual",
  blocks: [
    textBlock(new URL("./content/intro.md", import.meta.url), {
      kicker: true,
      title: "地下法阵",
    }),
    canvasBlock({
      title: "校准 Hoffman–Singleton 法阵",
      caption: "点击三个相位环上的节点切换接法；叉号表示共同邻居规则仍有冲突。",
      width: SIZE.width,
      height: SIZE.height,
      accessibility: { role: "application", focusable: true },
      revealDelayMs: 2400,
      createController: createRitualController,
    }),
    textBlock(new URL("./content/complete.md", import.meta.url)),
    actionsBlock([{ label: "查看行动结算", target: "results" }]),
  ],
};

export default ritualLevel;
