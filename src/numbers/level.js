import { actionsBlock, canvasBlock, textBlock } from "../level-blocks.js";
import { createNumbersController } from "./controller.js";

function puzzle(title, digit, target, numberCount) {
  return canvasBlock({
    title,
    caption: `把 ${numberCount} 个数字 ${digit} 全部合成 ${target}；每次把数字块拖到运算符上。`,
    width: 900,
    height: 460,
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
      title: "凑数字",
    }),
    textBlock(new URL("./content/unary.md", import.meta.url)),
    puzzle("只用 5 得到 24", 5, 24, 2),
    puzzle("只用 3 得到 8", 3, 8, 3),
    puzzle("只用 16 得到 47", 16, 47, 4),
    puzzle("只用 49 得到 121", 49, 121, 5),
    puzzle("只用 81 得到 5041", 81, 5041, 5),
    puzzle("只用 144 得到 3628801", 144, 3628801, 6),
    textBlock(new URL("./content/complete.md", import.meta.url)),
    actionsBlock([{ label: "启动二次曲线机", target: "quadratic" }]),
  ],
};

export default numbersLevel;
