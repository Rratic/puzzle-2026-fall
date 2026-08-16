import { componentBlock } from "../level-blocks.js";
import { createResultsController } from "./controller.js";

const resultsLevel = {
  id: "results",
  blocks: [
    componentBlock({
      className: "results-panel",
      createController: createResultsController,
    }),
  ],
};

export default resultsLevel;
