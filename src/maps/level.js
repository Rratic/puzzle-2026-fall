import { actionsBlock, canvasBlock, textBlock } from "../level-blocks.js";
import {
  createFourColorController,
  HEIGHT,
  WIDTH,
} from "./controller.js";
import { PLANAR_GRAPH } from "./graph-data.js";

const mapsLevel = {
  id: "maps",
  blocks: [
    textBlock(new URL("./content/intro.md", import.meta.url), {
      kicker: true,
      title: "平面图的四染色",
    }),
    canvasBlock({
      title: "为平面图着色",
      caption: "点击顶点轮换颜色",
      width: WIDTH,
      height: HEIGHT,
      graph: PLANAR_GRAPH,
      createController: createFourColorController,
    }),
    textBlock(new URL("./content/complete.md", import.meta.url)),
    actionsBlock([
      { label: "进入弯曲回廊", target: "hyperbolic" },
      { label: "检查算术控制室", target: "numbers" },
    ]),
  ],
};

export default mapsLevel;
