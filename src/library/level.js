import { actionsBlock, canvasBlock, textBlock } from "../level-blocks.js";
import { createPackingController } from "./controller.js";

const WORKSPACE = Object.freeze({ width: 1000, height: 690 });

const libraryLevel = {
  id: "library",
  blocks: [
    textBlock(new URL("./content/intro.md", import.meta.url), {
      kicker: true,
      title: "智华楼一楼图书角",
    }),
    canvasBlock({
      title: "书架",
      caption: "拖动方块移动；选中方块后，拖动圆盘指针旋转。",
      width: WORKSPACE.width,
      height: WORKSPACE.height,
      accessibility: { role: "application", focusable: false },
      boxTexture: new URL("../../assets/images/library/bookbox.jpg", import.meta.url),
      bookTextures: Array.from(
        { length: 17 },
        (_, index) => new URL(`../../assets/images/library/book${index + 1}.png`, import.meta.url),
      ),
      createController: createPackingController,
    }),
    textBlock(new URL("./content/complete.md", import.meta.url)),
    actionsBlock([{ label: "前往地下室", target: "mines" }]),
  ],
};

export default libraryLevel;
