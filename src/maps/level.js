import { actionsBlock, canvasBlock, textBlock } from "../level-blocks.js";
import { createFourColorController } from "./controller.js";
import { PLANAR_GRAPH } from "./graph-data.js";

const SIZE = Object.freeze({ width: 960, height: 620 });

const mapsLevel = {
  id: "maps",
  blocks: [
    textBlock(new URL("./content/intro.md", import.meta.url), {
      kicker: true,
      title: "深层楼梯间",
    }),
    canvasBlock({
      title: "为平面图着色",
      caption: "点击顶点轮换颜色",
      width: SIZE.width,
      height: SIZE.height,
      accessibility: { role: "application", focusable: true },
      graph: PLANAR_GRAPH,
      createController: createFourColorController,
    }),
    textBlock(new URL("./content/complete.md", import.meta.url)),
    actionsBlock([
      { label: "选择左侧", target: "hyperbolic" },
      { label: "选择右侧", target: "numbers" },
    ]),
  ],
};

export default mapsLevel;
