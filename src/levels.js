const levels = [
  level("corridor", () => import("./corridor/level.js")),
  level("library", () => import("./library/level.js"), "corridor"),
  level("mines", () => import("./mines/level.js"), "corridor"),
  level("maps", () => import("./maps/level.js"), "corridor"),
  level("hyperbolic", () => import("./hyperbolic/level.js"), "maps"),
  level("compass", () => import("./compass/level.js"), "hyperbolic"),
  level("numbers", () => import("./numbers/level.js"), "maps"),
  level("quadratic", () => import("./quadratic/level.js"), "numbers"),
  level("knots", () => import("./knots/level.js"), "maps"),
  level("ritual", () => import("./ritual/level.js"), "maps"),
  level("results", () => import("./results/level.js"), "ritual"),
];

function level(id, load, back = null) {
  return Object.freeze({ id, load, back });
}

export default levels;
