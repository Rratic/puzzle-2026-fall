import { canvasBlock, textBlock } from "../level-blocks.js";
import { createMinesweeperController } from "./controller.js";

const minesLevel = {
  id: "mines",
  blocks: [
    textBlock(new URL("./content/intro.html", import.meta.url), {
      kicker: true,
      title: "扫雷",
    }),
    canvasBlock({
      title: "扫雷",
      caption: "左键揭开，右键插旗；单击已揭开的数字展开相邻格。",
      width: 784,
      height: 560,
      mapSrc: new URL("./mines.json", import.meta.url),
      createController: createMinesweeperController,
    }),
  ],
};

export default minesLevel;
