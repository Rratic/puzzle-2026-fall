import { actionsBlock, canvasBlock, textBlock } from "../level-blocks.js";
import { createNumbersController } from "./controller.js";

function puzzle(title, digit, target, numberCount) {
  return canvasBlock({
    title,
    caption: `把 ${numberCount} 个数字 ${digit} 全部合成 ${target}；每次把数字块拖到运算符上。`,
    width: 900,
    height: 460,
    accessibility: { role: "application", focusable: false },
    digit,
    target,
    numberCount,
    createController: createNumbersController,
  });
}

const numbersLevel = {
  id: "numbers",
  blocks: [
    textBlock(new URL("./content/intro.md", import.meta.url), {
      kicker: true,
      title: "控制室的锁",
    }),
    puzzle("凑 24", 5, 24, 2),
    puzzle("凑 8", 3, 8, 3),
    puzzle("凑 47", 16, 47, 4),
    puzzle("凑 121", 49, 121, 5),
    puzzle("凑 3628801", 144, 3628801, 6),
    textBlock(new URL("./content/complete.md", import.meta.url)),
    actionsBlock([{ label: "进入控制室", target: "quadratic" }]),
  ],
};

export default numbersLevel;
