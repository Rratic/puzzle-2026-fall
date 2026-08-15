import { actionsBlock, canvasBlock, textBlock } from "../level-blocks.js";
import { createMinesweeperController } from "./controller.js";

const minesLevel = {
  id: "mines",
  blocks: [
    textBlock(new URL("./content/intro.md", import.meta.url), {
      kicker: true,
      title: "扫雷",
    }),
    canvasBlock({
      title: "扫雷",
      caption: "点击揭开，长按或右键插旗；点击已揭开的数字展开相邻格。",
      width: 784,
      height: 560,
      mapSrc: new URL("./mines.json", import.meta.url),
      createController: createMinesweeperController,
    }),
    textBlock(new URL("./content/complete.md", import.meta.url)),
    actionsBlock([{ label: "查看地下设施图", target: "maps" }]),
  ],
};

export default minesLevel;
