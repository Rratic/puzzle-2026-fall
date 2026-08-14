import { canvasBlock, textBlock } from "../level-blocks.js";
import {
  createPolynomialInputController,
  QUESTIONS,
  SIZE,
} from "./controller.js";

function quiz(title, question) {
  return canvasBlock({
    title,
    caption: "输入完整多项式并提交。",
    width: SIZE.width,
    height: SIZE.height,
    question,
    createController: createPolynomialInputController,
  });
}

const knotsLevel = {
  id: "knots",
  blocks: [
    textBlock(new URL("./content/intro.html", import.meta.url), {
      kicker: true,
      math: true,
      title: "扭结不变量",
    }),
    textBlock(new URL("./content/homfly.html", import.meta.url), { math: true }),
    quiz("两个分离的圆", QUESTIONS.unlink),
    quiz("两个互相穿过的圈", QUESTIONS.hopf),
    quiz("右手三叶结", QUESTIONS.trefoil),
    quiz("8 字结", QUESTIONS.figureEight),
    quiz("五叶结", QUESTIONS.cinquefoil),
  ],
};

export default knotsLevel;
