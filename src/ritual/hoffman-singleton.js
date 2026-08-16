const ORDER = 5;

export const PHASE_BUNDLES = Object.freeze([
  Object.freeze({ x: 0, m: 0 }),
  Object.freeze({ x: 2, m: 1 }),
  Object.freeze({ x: 4, m: 3 }),
]);

export const INITIAL_PHASES = Object.freeze([2, 3, 1]);

export function pointVertexIndex(x, y) {
  return x * ORDER + modulo(y);
}

function lineVertexIndex(m, b) {
  return ORDER * ORDER + m * ORDER + modulo(b);
}

export function createHoffmanSingletonGraph(phases = [0, 0, 0]) {
  const vertices = [];
  for (let x = 0; x < ORDER; x += 1) {
    for (let y = 0; y < ORDER; y += 1) {
      vertices.push({ id: `P${x}${y}`, family: "point", x, y });
    }
  }
  for (let m = 0; m < ORDER; m += 1) {
    for (let b = 0; b < ORDER; b += 1) {
      vertices.push({ id: `L${m}${b}`, family: "line", m, b });
    }
  }

  const adjacency = Array.from({ length: vertices.length }, () => new Set());
  const edges = [];
  const addEdge = (first, second, type, bundle = -1) => {
    adjacency[first].add(second);
    adjacency[second].add(first);
    edges.push({ first, second, type, bundle });
  };

  for (let x = 0; x < ORDER; x += 1) {
    for (let y = 0; y < ORDER; y += 1) {
      addEdge(pointVertexIndex(x, y), pointVertexIndex(x, y + 1), "pentagon");
    }
  }
  for (let m = 0; m < ORDER; m += 1) {
    for (let b = 0; b < ORDER; b += 1) {
      addEdge(lineVertexIndex(m, b), lineVertexIndex(m, b + 2), "pentagram");
    }
  }

  for (let x = 0; x < ORDER; x += 1) {
    for (let m = 0; m < ORDER; m += 1) {
      const bundle = PHASE_BUNDLES.findIndex(
        (candidate) => candidate.x === x && candidate.m === m,
      );
      const phase = bundle < 0 ? 0 : phases[bundle];
      for (let y = 0; y < ORDER; y += 1) {
        const b = modulo(y - m * x + phase);
        addEdge(
          pointVertexIndex(x, y),
          lineVertexIndex(m, b),
          "incidence",
          bundle,
        );
      }
    }
  }

  return { vertices, edges, adjacency };
}

export function analyzeHoffmanSingletonGraph(graph) {
  const degreeViolations = [];
  const pairViolations = [];

  graph.adjacency.forEach((neighbors, vertex) => {
    if (neighbors.size !== 7) {
      degreeViolations.push({ vertex, actual: neighbors.size });
    }
  });

  for (let first = 0; first < graph.vertices.length; first += 1) {
    for (let second = first + 1; second < graph.vertices.length; second += 1) {
      const common = [];
      graph.adjacency[first].forEach((neighbor) => {
        if (graph.adjacency[second].has(neighbor)) common.push(neighbor);
      });
      const adjacent = graph.adjacency[first].has(second);
      const expected = adjacent ? 0 : 1;
      if (common.length !== expected) {
        pairViolations.push({ first, second, common, adjacent, expected });
      }
    }
  }

  return {
    degreeViolations,
    pairViolations,
    violationCount: degreeViolations.length + pairViolations.length,
    solved: degreeViolations.length === 0 && pairViolations.length === 0,
  };
}

function modulo(value) {
  return ((value % ORDER) + ORDER) % ORDER;
}
