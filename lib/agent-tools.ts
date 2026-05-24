import type { Architecture } from "@/types";

// Tool 1: Trace all upstream and downstream paths for a module
export function traceDependency(module: string, architecture: Architecture): string {
  const upstream: string[] = [];
  const downstream: string[] = [];

  for (const dep of architecture.dependencies) {
    if (dep.to === module) upstream.push(dep.from);
    if (dep.from === module) downstream.push(dep.to);
  }

  // BFS for transitive upstreams
  const visited = new Set<string>([module]);
  const queue = [...upstream];
  const transitiveUpstreams: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    transitiveUpstreams.push(current);
    for (const dep of architecture.dependencies) {
      if (dep.to === current && !visited.has(dep.from)) {
        queue.push(dep.from);
      }
    }
  }

  return JSON.stringify({
    module,
    upstream,
    downstream,
    transitive_upstreams: transitiveUpstreams,
    total_impact_surface: upstream.length + downstream.length + transitiveUpstreams.length,
  });
}

// Tool 2: Detect circular dependency chains
export function checkCircular(modules: string[], architecture: Architecture): string {
  const moduleSet = new Set(modules);
  const cycles: string[][] = [];

  // DFS cycle detection
  const color = new Map<string, "white" | "gray" | "black">();
  const parent = new Map<string, string>();

  for (const m of modules) color.set(m, "white");

  function dfs(node: string, path: string[]): void {
    color.set(node, "gray");
    path.push(node);

    for (const dep of architecture.dependencies) {
      if (dep.from !== node || !moduleSet.has(dep.to)) continue;
      const neighbor = dep.to;

      if (color.get(neighbor) === "gray") {
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), neighbor]);
        }
      } else if (color.get(neighbor) === "white") {
        parent.set(neighbor, node);
        dfs(neighbor, [...path]);
      }
    }

    color.set(node, "black");
  }

  for (const m of modules) {
    if (color.get(m) === "white") dfs(m, []);
  }

  return JSON.stringify({
    hasCycles: cycles.length > 0,
    cycles,
    cycleCount: cycles.length,
  });
}

// Tool 3: Estimate blast radius from impacted module list
export function estimateBlastRadius(impactedModules: string[], architecture: Architecture): string {
  const impactedSet = new Set(impactedModules);
  const transitiveSet = new Set(impactedModules);

  // BFS to find all transitive dependents
  const queue = [...impactedModules];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const dep of architecture.dependencies) {
      if (dep.from === current && !transitiveSet.has(dep.to)) {
        transitiveSet.add(dep.to);
        queue.push(dep.to);
      }
    }
  }

  const transitiveOnly = [...transitiveSet].filter((m) => !impactedSet.has(m));

  return JSON.stringify({
    directCount: impactedModules.length,
    transitiveCount: transitiveOnly.length,
    totalAffected: transitiveSet.size,
    transitiveModules: transitiveOnly,
    percentageOfSystem:
      architecture.modules.length > 0
        ? Math.round((transitiveSet.size / architecture.modules.length) * 100)
        : 0,
  });
}

// Tool 4: Generate safe deployment order (topological sort)
export function generateMigrationPath(risks: string[], architecture: Architecture): string {
  const riskSet = new Set(risks);
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();

  for (const m of risks) {
    inDegree.set(m, 0);
    graph.set(m, []);
  }

  for (const dep of architecture.dependencies) {
    if (riskSet.has(dep.from) && riskSet.has(dep.to)) {
      graph.get(dep.from)!.push(dep.to);
      inDegree.set(dep.to, (inDegree.get(dep.to) ?? 0) + 1);
    }
  }

  // Kahn's algorithm
  const queue = [...risks].filter((m) => (inDegree.get(m) ?? 0) === 0);
  const order: string[] = [];
  const warnings: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const neighbor of graph.get(node) ?? []) {
      inDegree.set(neighbor, (inDegree.get(neighbor) ?? 0) - 1);
      if (inDegree.get(neighbor) === 0) queue.push(neighbor);
    }
  }

  if (order.length < risks.length) {
    warnings.push("Circular dependencies detected — manual ordering required for some modules.");
    for (const m of risks) {
      if (!order.includes(m)) order.push(m);
    }
  }

  return JSON.stringify({
    deploymentOrder: order,
    warnings,
    tip: "Deploy in the order listed. Each module should be stable before deploying the next.",
  });
}

// Tool dispatcher
export function executeTool(
  name: string,
  input: Record<string, unknown>,
  architecture: Architecture
): string {
  switch (name) {
    case "trace_dependency":
      return traceDependency(input.module as string, architecture);
    case "check_circular":
      return checkCircular(input.modules as string[], architecture);
    case "estimate_blast_radius":
      return estimateBlastRadius(input.impacted_modules as string[], architecture);
    case "generate_migration_path":
      return generateMigrationPath(input.risks as string[], architecture);
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
