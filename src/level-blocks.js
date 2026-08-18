const BLOCK_TYPES = new Set(["text", "canvas", "component", "actions"]);

export function textBlock(src, options = {}) {
  return { ...options, type: "text", src };
}

export function canvasBlock(options) {
  return { ...options, type: "canvas" };
}

export function componentBlock(options) {
  return { ...options, type: "component" };
}

export function actionsBlock(actions) {
  return { type: "actions", actions };
}

export function validateLevel(level, expectedId, knownLevels) {
  if (!level || typeof level !== "object") {
    throw new TypeError("Level module must export a level object.");
  }
  if (typeof level.id !== "string" || level.id.length === 0) {
    throw new TypeError("Level must provide a non-empty id.");
  }
  if (level.id !== expectedId) {
    throw new Error(`Loaded level "${level.id}" for route "${expectedId}".`);
  }
  if (!Array.isArray(level.blocks) || level.blocks.length === 0) {
    throw new TypeError(`Level "${level.id}" must provide at least one block.`);
  }

  level.blocks.forEach((block, index) =>
    validateBlock(level.id, block, index, knownLevels),
  );
  return level;
}

function validateBlock(levelId, block, index, knownLevels) {
  const location = `Level "${levelId}" block ${index + 1}`;
  if (!block || typeof block !== "object" || !BLOCK_TYPES.has(block.type)) {
    throw new TypeError(`${location} has an unknown block type.`);
  }

  if (block.type === "text") {
    if (!block.src) {
      throw new TypeError(`${location} must provide src.`);
    }
  }
  if (block.type === "canvas") {
    if (typeof block.title !== "string" || block.title.length === 0) {
      throw new TypeError(`${location} must provide a title.`);
    }
    if (
      !Number.isFinite(block.width) || block.width <= 0 ||
      !Number.isFinite(block.height) || block.height <= 0
    ) {
      throw new TypeError(`${location} must provide positive canvas dimensions.`);
    }
    if (typeof block.createController !== "function") {
      throw new TypeError(`${location} must provide createController().`);
    }
  }
  if (block.type === "component" && typeof block.createController !== "function") {
    throw new TypeError(`${location} must provide createController().`);
  }
  if (block.type === "actions") {
    if (!Array.isArray(block.actions)) {
      throw new TypeError(`${location} must provide an actions array.`);
    }
    block.actions.forEach((action) => {
      if (!action || typeof action.label !== "string" || typeof action.target !== "string") {
        throw new TypeError(`${location} contains an invalid action.`);
      }
      if (knownLevels && !knownLevels.has(action.target)) {
        throw new Error(`${location} targets unknown level "${action.target}".`);
      }
    });
  }
}
