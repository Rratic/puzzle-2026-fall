import { actionsBlock, textBlock } from "../level-blocks.js";

const corridorLevel = {
	id: "corridor",
	blocks: [
		textBlock(new URL("./content/intro.html", import.meta.url), {
			kicker: true,
			title: "智华楼一楼走廊",
		}),
		actionsBlock([{ label: "前往图书角", target: "library" }]),
	],
};

export default corridorLevel;
