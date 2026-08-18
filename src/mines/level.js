import { actionsBlock, canvasBlock, textBlock } from "../level-blocks.js";
import { createMinesweeperController } from "./controller.js";

const minesLevel = {
  id: "mines",
  blocks: [
    textBlock(new URL("./content/intro.md", import.meta.url), {
      kicker: true,
      title: "机关区",
    }),
    canvasBlock({
      title: "扫雷",
      caption: "点击插旗或取消插旗；拖动放大镜到格子上揭开该格。",
      width: 784,
      height: 640,
      accessibility: { role: "application", focusable: true },
      mapSrc: new URL("./mines.json", import.meta.url),
      createController: createMinesweeperController,
    }),
    textBlock(new URL("./content/complete.md", import.meta.url)),
    actionsBlock([{ label: "进入深层楼梯间", target: "maps" }]),
  ],
};

export default minesLevel;
