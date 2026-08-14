import { actionsBlock, textBlock } from "../level-blocks.js";

const corridorLevel = {
	id: "corridor",
	blocks: [
		textBlock(new URL("./content/intro.md", import.meta.url), {
			kicker: true,
			title: "智华楼一楼走廊",
		}),
		actionsBlock([
			{ label: "沿脚印前往地下室", target: "mines" },
			{ label: "调查图书角", target: "library" },
		]),
	],
};

export default corridorLevel;
