export interface TopoNode {
  id: string;
  dependencies: string[];
}

/**
 * Topological sort using Kahn's algorithm
 * Returns execution waves — agents in same wave run in parallel
 * Example input:  [{id:'auth',dependencies:[]}, {id:'db',dependencies:[]}, {id:'routes',dependencies:['auth','db']}]
 * Example output: [['auth','db'], ['routes']]
 * auth and db run in parallel first, routes runs after both finish
 */
export function topoSort(nodes: TopoNode[]): string[][] {
  // Step 1 — build in-degree map (how many dependencies each node has)
  const inDegree: Record<string, number> = {};
  const graph: Record<string, string[]> = {};

  nodes.forEach(node => {
    inDegree[node.id] = node.dependencies.length;
    graph[node.id] = [];
  });

  // Step 2 — build adjacency list (who unlocks who)
  nodes.forEach(node => {
    node.dependencies.forEach(dep => {
      if (!graph[dep]) {
        throw new Error(`Dependency '${dep}' not found in modules`);
      }
      graph[dep].push(node.id);
    });
  });

  // Step 3 — start with nodes that have no dependencies
  const waves: string[][] = [];
  let available = nodes
    .filter(n => inDegree[n.id] === 0)
    .map(n => n.id);

  if (available.length === 0 && nodes.length > 0) {
    throw new Error('Circular dependency detected — no node has zero dependencies');
  }

  // Step 4 — process wave by wave
  while (available.length > 0) {
    waves.push([...available]);

    const nextWave: string[] = [];

    available.forEach(id => {
      graph[id].forEach(dependent => {
        inDegree[dependent]--;
        if (inDegree[dependent] === 0) {
          nextWave.push(dependent);
        }
      });
    });

    available = nextWave;
  }

  // Step 5 — detect any remaining circular deps
  const processed = waves.flat().length;
  if (processed !== nodes.length) {
    throw new Error('Circular dependency detected — not all modules could be sorted');
  }

  return waves;
}

/**
 * Validate no circular dependencies exist before starting
 */
export function validateNoCycles(nodes: TopoNode[]): boolean {
  try {
    topoSort(nodes);
    return true;
  } catch {
    return false;
  }
}