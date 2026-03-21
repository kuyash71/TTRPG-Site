/**
 * Skill tree prerequisite graph'ında DFS ile döngü tespiti.
 * Editör (client-side) ve API (server-side) tarafından kullanılır.
 */

interface GraphNode {
  id: string;
  prerequisites: string[];
}

interface CycleResult {
  hasCycle: boolean;
  /** Döngü yolu (varsa): [A, B, C, A] */
  path?: string[];
}

/**
 * DFS ile döngü tespiti yapar.
 * Her node'un prerequisite'lerini takip eder.
 */
export function detectCycle(nodes: GraphNode[]): CycleResult {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    // prerequisite → node yönünde edge (prereq tamamlanmadan node açılamaz)
    // Döngü tespiti için: node'un prerequisite'lerine bakarız
    adjacency.set(node.id, node.prerequisites);
  }

  const WHITE = 0; // Ziyaret edilmedi
  const GRAY = 1; // İşleniyor (stack'te)
  const BLACK = 2; // Tamamlandı

  const color = new Map<string, number>();

  for (const node of nodes) {
    color.set(node.id, WHITE);
  }

  function dfs(nodeId: string, path: string[]): CycleResult {
    color.set(nodeId, GRAY);
    path.push(nodeId);

    const prereqs = adjacency.get(nodeId) ?? [];
    for (const prereqId of prereqs) {
      if (!color.has(prereqId)) continue; // Geçersiz referans, atla

      if (color.get(prereqId) === GRAY) {
        // Döngü bulundu
        const cycleStart = path.indexOf(prereqId);
        const cyclePath = [...path.slice(cycleStart), prereqId];
        return { hasCycle: true, path: cyclePath };
      }

      if (color.get(prereqId) === WHITE) {
        const result = dfs(prereqId, path);
        if (result.hasCycle) return result;
      }
    }

    color.set(nodeId, BLACK);
    path.pop();
    return { hasCycle: false };
  }

  for (const node of nodes) {
    if (color.get(node.id) === WHITE) {
      const result = dfs(node.id, []);
      if (result.hasCycle) return result;
    }
  }

  return { hasCycle: false };
}

/**
 * Belirli bir edge eklendiğinde döngü oluşup oluşmayacağını kontrol eder.
 * Editörde yeni prerequisite eklerken kullanılır.
 */
export function wouldCreateCycle(
  nodes: GraphNode[],
  fromNodeId: string,
  newPrereqId: string
): boolean {
  // Geçici olarak edge'i ekle ve kontrol et
  const tempNodes = nodes.map((n) => {
    if (n.id === fromNodeId) {
      return { ...n, prerequisites: [...n.prerequisites, newPrereqId] };
    }
    return n;
  });
  return detectCycle(tempNodes).hasCycle;
}
