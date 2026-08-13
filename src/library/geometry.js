export const BOARD = Object.freeze({ x: 42, y: 64, size: 470 });
export const PIECE_SIZE = 100;
export const DIAL = Object.freeze({ radius: 38, handleRadius: 9, hitRadius: 16 });
export const EPSILON = 0.01;
export const BOARD_WALL_THICKNESS = 18;

export function createPieces() {
  const pieces = [];
  for (let index = 0; index < 17; index += 1) {
    pieces.push({
      x: 590 + (index % 4) * 110,
      y: 102 + Math.floor(index / 4) * 120,
      angle: 0,
    });
  }
  return pieces;
}

export function getCorners(piece) {
  const half = PIECE_SIZE / 2;
  const cos = Math.cos(piece.angle);
  const sin = Math.sin(piece.angle);
  return [
    { x: -half, y: -half },
    { x: half, y: -half },
    { x: half, y: half },
    { x: -half, y: half },
  ].map((corner) => ({
    x: piece.x + corner.x * cos - corner.y * sin,
    y: piece.y + corner.x * sin + corner.y * cos,
  }));
}

export function getDialHandle(piece) {
  return {
    x: piece.x + Math.cos(piece.angle) * DIAL.radius,
    y: piece.y + Math.sin(piece.angle) * DIAL.radius,
  };
}

export function pointInPiece(point, piece) {
  const dx = point.x - piece.x;
  const dy = point.y - piece.y;
  const cos = Math.cos(-piece.angle);
  const sin = Math.sin(-piece.angle);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  const half = PIECE_SIZE / 2;
  return Math.abs(localX) <= half && Math.abs(localY) <= half;
}

export function isPieceInsideBoard(piece) {
  return getCorners(piece).every((corner) =>
    corner.x >= BOARD.x - EPSILON &&
    corner.x <= BOARD.x + BOARD.size + EPSILON &&
    corner.y >= BOARD.y - EPSILON &&
    corner.y <= BOARD.y + BOARD.size + EPSILON
  );
}

export function getBoardWalls() {
  const right = BOARD.x + BOARD.size;
  const bottom = BOARD.y + BOARD.size;
  return [
    rectangleCorners(
      BOARD.x - BOARD_WALL_THICKNESS,
      BOARD.y - BOARD_WALL_THICKNESS,
      right,
      BOARD.y,
    ),
    rectangleCorners(
      BOARD.x - BOARD_WALL_THICKNESS,
      BOARD.y,
      BOARD.x,
      bottom,
    ),
    rectangleCorners(
      BOARD.x - BOARD_WALL_THICKNESS,
      bottom,
      right,
      bottom + BOARD_WALL_THICKNESS,
    ),
  ];
}

function rectangleCorners(left, top, right, bottom) {
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

export function polygonsOverlap(first, second) {
  const axes = [...getAxes(first), ...getAxes(second)];
  return axes.every((axis) => {
    const firstProjection = projectPolygon(first, axis);
    const secondProjection = projectPolygon(second, axis);
    return !(
      firstProjection.max <= secondProjection.min + EPSILON ||
      secondProjection.max <= firstProjection.min + EPSILON
    );
  });
}

function getAxes(polygon) {
  return polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    const edgeX = next.x - point.x;
    const edgeY = next.y - point.y;
    const length = Math.hypot(edgeX, edgeY) || 1;
    return { x: -edgeY / length, y: edgeX / length };
  });
}

function projectPolygon(polygon, axis) {
  const values = polygon.map((point) => point.x * axis.x + point.y * axis.y);
  return { min: Math.min(...values), max: Math.max(...values) };
}

export function dotProduct(first, second) {
  return first.x * second.x + first.y * second.y;
}

export function angleBetween(origin, point) {
  return Math.atan2(point.y - origin.y, point.x - origin.x);
}
