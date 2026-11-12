// Otimização da ordem das paradas (problema do caixeiro viajante, versão "caminho aberto").
//
// A rota sempre começa no índice 0 (ponto de partida) e NÃO volta para ele no fim.
// matrix[i][j] = custo para ir de i até j (metros ou segundos). Pode ser assimétrica
// (ida e volta podem ter custos diferentes por causa de mão única, por exemplo).

// Até este número de paradas, testamos todas as ordens possíveis (resultado garantidamente ótimo).
const EXACT_LIMIT = 9;

export function pathCost(route, matrix) {
  let cost = 0;
  for (let i = 0; i < route.length - 1; i++) {
    cost += matrix[route[i]][route[i + 1]];
  }
  return cost;
}

export function solveOpenTsp(matrix) {
  const n = matrix.length;
  if (n <= 2) return [...Array(n).keys()];
  if (n - 1 <= EXACT_LIMIT) return exactSearch(matrix);
  return iteratedLocalSearch(matrix);
}

// Busca local iterada: parte da melhor rota conhecida, "embaralha" um pedaço dela
// (perturbação double-bridge), aplica a busca local de novo e guarda se melhorou.
// Isso escapa de ótimos locais em que a busca local sozinha fica presa.
export function iteratedLocalSearch(matrix, { timeBudgetMs = 400, maxIterations = 300, seed = 12345 } = {}) {
  const n = matrix.length;
  const rand = seededRandom(seed);
  let best = localSearch(nearestNeighbor(matrix), matrix);
  let bestCost = pathCost(best, matrix);
  if (n < 6) return best;

  const deadline = Date.now() + timeBudgetMs;
  for (let it = 0; it < maxIterations && Date.now() < deadline; it++) {
    const candidate = localSearch(doubleBridge(best, rand), matrix);
    const cost = pathCost(candidate, matrix);
    if (cost < bestCost - 1e-9) {
      best = candidate;
      bestCost = cost;
    }
  }
  return best;
}

// Corta a rota (sem mexer no ponto de partida) em 4 pedaços A B C D e remonta como A C B D.
function doubleBridge(route, rand) {
  const n = route.length;
  const cuts = new Set();
  while (cuts.size < 3) cuts.add(1 + Math.floor(rand() * (n - 1)));
  const [p1, p2, p3] = [...cuts].sort((a, b) => a - b);
  return route.slice(0, p1).concat(route.slice(p2, p3), route.slice(p1, p2), route.slice(p3));
}

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Busca exaustiva com poda (branch and bound): descarta caminhos que já ficaram
// mais caros que o melhor encontrado até agora.
export function exactSearch(matrix) {
  const n = matrix.length;
  const used = new Array(n).fill(false);
  const path = [0];
  used[0] = true;
  let best = Infinity;
  let bestRoute = null;

  function dfs(cost) {
    if (cost >= best) return;
    if (path.length === n) {
      best = cost;
      bestRoute = path.slice();
      return;
    }
    const last = path[path.length - 1];
    // Visita primeiro os vizinhos mais próximos: acha boas soluções cedo e poda mais.
    const candidates = [];
    for (let j = 1; j < n; j++) if (!used[j]) candidates.push(j);
    candidates.sort((a, b) => matrix[last][a] - matrix[last][b]);
    for (const j of candidates) {
      used[j] = true;
      path.push(j);
      dfs(cost + matrix[last][j]);
      path.pop();
      used[j] = false;
    }
  }

  dfs(0);
  return bestRoute;
}

// Heurística do vizinho mais próximo: sempre vai para a parada mais perto ainda não visitada.
export function nearestNeighbor(matrix) {
  const n = matrix.length;
  const visited = new Array(n).fill(false);
  const route = [0];
  visited[0] = true;
  for (let step = 1; step < n; step++) {
    const last = route[route.length - 1];
    let next = -1;
    for (let j = 0; j < n; j++) {
      if (!visited[j] && (next === -1 || matrix[last][j] < matrix[last][next])) next = j;
    }
    visited[next] = true;
    route.push(next);
  }
  return route;
}

// Melhoria local: repete dois tipos de movimento até nenhum deles ajudar mais.
//  - 2-opt: inverte um trecho da rota (desfaz "cruzamentos").
//  - Or-opt: tira um bloco de 1 a 3 paradas e encaixa em outra posição.
// O custo é recalculado inteiro a cada tentativa porque a matriz pode ser assimétrica.
export function localSearch(initialRoute, matrix) {
  let route = initialRoute.slice();
  let best = pathCost(route, matrix);
  const n = route.length;
  const EPS = 1e-9;
  let improved = true;

  while (improved) {
    improved = false;

    for (let i = 1; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const candidate = route.slice(0, i)
          .concat(route.slice(i, k + 1).reverse(), route.slice(k + 1));
        const cost = pathCost(candidate, matrix);
        if (cost < best - EPS) {
          route = candidate;
          best = cost;
          improved = true;
        }
      }
    }

    for (let len = 1; len <= 3; len++) {
      for (let i = 1; i + len <= n; i++) {
        const block = route.slice(i, i + len);
        const rest = route.slice(0, i).concat(route.slice(i + len));
        for (let pos = 1; pos <= rest.length; pos++) {
          if (pos === i) continue;
          const candidate = rest.slice(0, pos).concat(block, rest.slice(pos));
          const cost = pathCost(candidate, matrix);
          if (cost < best - EPS) {
            route = candidate;
            best = cost;
            improved = true;
            break;
          }
        }
      }
    }
  }

  return route;
}
