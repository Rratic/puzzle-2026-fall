const levels = [
  level("corridor", () => import("./corridor/level.js")),
  level("library", () => import("./library/level.js")),
  level("compass", () => import("./compass/level.js")),
  level("hyperbolic", () => import("./hyperbolic/level.js")),
  level("maps", () => import("./maps/level.js")),
  level("mines", () => import("./mines/level.js")),
  level("quadratic", () => import("./quadratic/level.js")),
];

function level(id, load) {
  return Object.freeze({ id, load });
}

export default levels;
