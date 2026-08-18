import { actionsBlock, canvasBlock, textBlock } from "../level-blocks.js";
import { createPolynomialInputController } from "./controller.js";
import { QUESTIONS } from "./questions.js";

const SIZE = Object.freeze({ width: 920, height: 460 });

function quiz(title, question) {
  return canvasBlock({
    title,
    caption: "输入完整多项式并提交。",
    width: SIZE.width,
    height: SIZE.height,
    accessibility: { role: "img", focusable: false },
    question,
    createController: createPolynomialInputController,
  });
}

const knotsLevel = {
  id: "knots",
  blocks: [
    textBlock(new URL("./content/intro.md", import.meta.url), {
      kicker: true,
      title: "档案室",
    }),
    textBlock(new URL("./content/homfly.md", import.meta.url)),
    quiz("两个分离的圆", QUESTIONS.unlink),
    quiz("互相穿过的圈（正交叉版）", QUESTIONS.hopf),
    quiz("右手三叶结", QUESTIONS.trefoil),
    quiz("8 字结", QUESTIONS.figureEight),
    textBlock(new URL("./content/complete.md", import.meta.url)),
    actionsBlock([{ label: "进入地下法阵", target: "ritual" }]),
  ],
};

export default knotsLevel;
