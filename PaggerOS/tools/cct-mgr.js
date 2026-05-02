/** @param {NS} ns **/
export async function main(ns) {
  const mode = String(ns.args[0] || "list").toLowerCase();
  const targetArg = ns.args[1];

  const servers = getAllServers(ns);
  let contracts = findContracts(ns, servers);

  contracts.sort((a, b) => {
    if (a.tries !== b.tries) return a.tries - b.tries;
    if (a.server !== b.server) return a.server.localeCompare(b.server);
    return a.file.localeCompare(b.file);
  });

  if (mode === "list") {
    listContracts(ns, contracts);
    return;
  }

  if (mode === "show") {
    showContracts(ns, contracts);
    return;
  }

  if (mode === "solve") {
    solveContracts(ns, contracts);
    return;
  }

  if (mode === "goto") {
    gotoContract(ns, contracts, targetArg);
    return;
  }

  ns.tprint(`Unknown mode: ${mode}`);
  ns.tprint(`Usage: run tools/cct-manager.js [list|show|solve|goto] [index]`);
}

function getAllServers(ns) {
  const seen = new Set(["home"]);
  const queue = ["home"];

  while (queue.length > 0) {
    const host = queue.shift();
    for (const next of ns.scan(host)) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }

  return [...seen];
}

function findContracts(ns, servers) {
  const out = [];
  for (const server of servers) {
    const files = ns.ls(server, ".cct");
    for (const file of files) {
      out.push({
        server,
        file,
        type: ns.codingcontract.getContractType(file, server),
        tries: ns.codingcontract.getNumTriesRemaining(file, server),
        data: ns.codingcontract.getData(file, server),
        desc: ns.codingcontract.getDescription(file, server),
      });
    }
  }
  return out;
}

function listContracts(ns, contracts) {
  ns.tprint(`Found ${contracts.length} contract(s)`);
  for (let i = 0; i < contracts.length; i++) {
    const c = contracts[i];
    ns.tprint(`[${i}] ${c.server} -> ${c.file} | ${c.type} | tries=${c.tries}`);
  }
}

function showContracts(ns, contracts) {
  ns.tprint(`Found ${contracts.length} contract(s)`);
  for (let i = 0; i < contracts.length; i++) {
    const c = contracts[i];
    ns.tprint(``);
    ns.tprint(`[${i}] ${c.server} -> ${c.file}`);
    ns.tprint(`Type: ${c.type}`);
    ns.tprint(`Tries: ${c.tries}`);
    ns.tprint(`Data: ${JSON.stringify(c.data)}`);
    ns.tprint(`Description: ${c.desc}`);
  }
}

function solveContracts(ns, contracts) {
  let solved = 0;
  let unsupported = 0;
  let failed = 0;

  ns.tprint(`Coding contracts...`);

  for (const c of contracts) {
    let answer = null;

    try {
      answer = solveContract(c.type, c.data);
    } catch (err) {
      ns.tprint(`❌ Solver error: ${c.type} on ${c.server} (${c.file}) -> ${String(err)}`);
      failed++;
      continue;
    }

    if (answer === null || answer === undefined) {
      ns.tprint(`⚠️ No solver for: ${c.type} on ${c.server} (${c.file})`);
      unsupported++;
      continue;
    }

    let reward = "";
    try {
      reward = ns.codingcontract.attempt(answer, c.file, c.server, { returnReward: true });
    } catch (err) {
      ns.tprint(`❌ Attempt error: ${c.type} on ${c.server} (${c.file}) -> ${String(err)}`);
      failed++;
      continue;
    }

    if (reward) {
      ns.tprint(`✅ Solved: ${c.type} on ${c.server} (${c.file}) — ${reward}`);
      solved++;
    } else {
      ns.tprint(`❌ Failed: ${c.type} on ${c.server} (${c.file}) | answer=${JSON.stringify(answer)}`);
      failed++;
    }
  }

  ns.tprint(``);
  ns.tprint(`Solved: ${solved}`);
  ns.tprint(`Unsupported: ${unsupported}`);
  ns.tprint(`Failed: ${failed}`);
}

function gotoContract(ns, contracts, targetArg) {
  const index = Number(targetArg);

  if (!Number.isInteger(index) || index < 0 || index >= contracts.length) {
    ns.tprint(`Usage: run tools/cct-manager.js goto [index]`);
    ns.tprint(`Pick an index from: run tools/cct-manager.js list`);
    return;
  }

  const c = contracts[index];
  const path = findPath(ns, "home", c.server);

  if (!path) {
    ns.tprint(`No path found to ${c.server}`);
    return;
  }

  if (!ns.singularity) {
    ns.tprint(`Singularity API not available.`);
    return;
  }

  ns.singularity.connect("home");
  for (const host of path.slice(1)) {
    const ok = ns.singularity.connect(host);
    if (!ok) {
      ns.tprint(`Failed to connect to ${host}`);
      return;
    }
  }

  ns.tprint(`Connected to ${c.server}`);
  ns.tprint(`Contract: ${c.file}`);
  ns.tprint(`Type: ${c.type}`);
  ns.tprint(`Tries: ${c.tries}`);
}

function findPath(ns, start, target) {
  const queue = [[start]];
  const seen = new Set([start]);

  while (queue.length > 0) {
    const path = queue.shift();
    const node = path[path.length - 1];

    if (node === target) return path;

    for (const next of ns.scan(node)) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push([...path, next]);
      }
    }
  }

  return null;
}

function solveContract(type, data) {
  switch (type) {
    case "Find Largest Prime Factor":
      return largestPrimeFactor(data);

    case "Subarray with Maximum Sum":
      return maxSubarraySum(data);

    case "Total Ways to Sum":
      return totalWaysToSum(data);

    case "Total Ways to Sum II":
      return totalWaysToSumII(data);

    case "Spiralize Matrix":
      return spiralizeMatrix(data);

    case "Array Jumping Game":
      return arrayJumpingGame(data);

    case "Array Jumping Game II":
      return arrayJumpingGameII(data);

    case "Merge Overlapping Intervals":
      return mergeOverlappingIntervals(data);

    case "Generate IP Addresses":
      return generateIPAddresses(data);

    case "Algorithmic Stock Trader I":
      return stockTraderI(data);

    case "Algorithmic Stock Trader II":
      return stockTraderII(data);

    case "Algorithmic Stock Trader III":
      return stockTraderIII(data);

    case "Algorithmic Stock Trader IV":
      return stockTraderIV(data);

    case "Minimum Path Sum in a Triangle":
      return minPathTriangle(data);

    case "Unique Paths in a Grid I":
      return uniquePathsI(data);

    case "Unique Paths in a Grid II":
      return uniquePathsII(data);

    case "Shortest Path in a Grid":
      return shortestPathInGrid(data);

    case "Sanitize Parentheses in Expression":
      return sanitizeParentheses(data);

    case "Find All Valid Math Expressions":
      return findAllValidMathExpressions(data);

    case "Proper 2-Coloring of a Graph":
      return proper2Coloring(data);

    case "Compression I: RLE Compression":
      return rleCompression(data);

    case "Compression II: LZ Decompression":
      return lzDecompression(data);

    case "Compression III: LZ Compression":
      return lzCompression(data);

    case "Encryption I: Caesar Cipher":
      return caesarCipher(data);

    case "Encryption II: Vigenère Cipher":
      return vigenereCipher(data);

    case "HammingCodes: Integer to Encoded Binary":
      return hammingEncode(data);

    case "HammingCodes: Encoded Binary to Integer":
      return hammingDecode(data);

    case "Square Root":
      return sqrtNearest(data);

    case "Largest Rectangle in a Matrix":
      return solveLargestRectangleInAMatrix(data);

    case "Total Number of Primes":
      return solveTotalNumberOfPrimes(data);      

    default:
      return null;
  }
}

function largestPrimeFactor(n) {
  let factor = 2;
  while (factor * factor <= n) {
    while (n % factor === 0) n = Math.floor(n / factor);
    factor++;
  }
  return n;
}
function solveTotalNumberOfPrimes(data) {
  if (Array.isArray(data)) {
    const min = Number(data[0]);
    const max = Number(data[1]);
    return countPrimesBetween(min, max);
  }

  const n = Number(data);

  // Classic Bitburner behaviour: count primes strictly less than n.
  return countPrimesBetween(2, n - 1);
}

function countPrimesBetween(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);

  if (!Number.isFinite(min) || !Number.isFinite(max)) return 0;
  if (max < 2 || min > max) return 0;

  min = Math.max(min, 2);

  const sieve = Array(max + 1).fill(true);
  sieve[0] = false;
  sieve[1] = false;

  for (let p = 2; p * p <= max; p++) {
    if (!sieve[p]) continue;

    for (let multiple = p * p; multiple <= max; multiple += p) {
      sieve[multiple] = false;
    }
  }

  let count = 0;

  for (let n = min; n <= max; n++) {
    if (sieve[n]) count++;
  }

  return count;
}
function maxSubarraySum(arr) {
  let max = -Infinity;
  let cur = 0;
  for (const n of arr) {
    cur = Math.max(n, cur + n);
    max = Math.max(max, cur);
  }
  return max;
}

function totalWaysToSum(n) {
  const dp = Array(n + 1).fill(0);
  dp[0] = 1;
  for (let i = 1; i < n; i++) {
    for (let j = i; j <= n; j++) {
      dp[j] += dp[j - i];
    }
  }
  return dp[n];
}

function totalWaysToSumII(data) {
  const target = data[0];
  const nums = data[1];
  const dp = Array(target + 1).fill(0);
  dp[0] = 1;

  for (const num of nums) {
    for (let i = num; i <= target; i++) {
      dp[i] += dp[i - num];
    }
  }

  return dp[target];
}

function spiralizeMatrix(data) {
  const result = [];
  let top = 0;
  let bottom = data.length - 1;
  let left = 0;
  let right = data[0].length - 1;

  while (top <= bottom && left <= right) {
    for (let i = left; i <= right; i++) result.push(data[top][i]);
    top++;

    for (let i = top; i <= bottom; i++) result.push(data[i][right]);
    right--;

    if (top <= bottom) {
      for (let i = right; i >= left; i--) result.push(data[bottom][i]);
      bottom--;
    }

    if (left <= right) {
      for (let i = bottom; i >= top; i--) result.push(data[i][left]);
      left++;
    }
  }

  return result;
}
function normaliseBinaryMatrix(data) {
  if (!Array.isArray(data)) return [];

  return data.map(row => {
    if (Array.isArray(row)) {
      return row.map(x => Number(x));
    }

    if (typeof row === "string") {
      return row
        .replace(/[\[\],\s]/g, "")
        .split("")
        .filter(x => x === "0" || x === "1")
        .map(Number);
    }

    return [];
  });
}

function solveLargestRectangleInAMatrix(data) {
  const matrix = normaliseBinaryMatrix(data);

  if (matrix.length === 0 || matrix[0].length === 0) return "";

  const rows = matrix.length;
  const cols = matrix[0].length;

  let bestArea = 0;
  let best = "";

  for (let top = 0; top < rows; top++) {
    const clearCols = Array(cols).fill(true);

    for (let bottom = top; bottom < rows; bottom++) {
      for (let c = 0; c < cols; c++) {
        if (matrix[bottom][c] === 1) {
          clearCols[c] = false;
        }
      }

      let left = 0;

      while (left < cols) {
        while (left < cols && !clearCols[left]) left++;

        let right = left;

        while (right < cols && clearCols[right]) right++;

        if (right > left) {
          const area = (bottom - top + 1) * (right - left);

          if (area > bestArea) {
            bestArea = area;
            best = [
              [top, left],
              [bottom, right - 1],
            ];
          }
        }

        left = right + 1;
      }
    }
  }

  return best;
}
function arrayJumpingGame(arr) {
  let reach = 0;
  for (let i = 0; i < arr.length; i++) {
    if (i > reach) return 0;
    reach = Math.max(reach, i + arr[i]);
  }
  return 1;
}

function arrayJumpingGameII(arr) {
  if (arr.length <= 1) return 0;

  let jumps = 0;
  let currentEnd = 0;
  let farthest = 0;

  for (let i = 0; i < arr.length - 1; i++) {
    farthest = Math.max(farthest, i + arr[i]);
    if (i === currentEnd) {
      if (farthest <= i) return 0;
      jumps++;
      currentEnd = farthest;
      if (currentEnd >= arr.length - 1) return jumps;
    }
  }

  return 0;
}

function mergeOverlappingIntervals(intervals) {
  if (intervals.length === 0) return [];
  const sorted = intervals.map(x => x.slice()).sort((a, b) => a[0] - b[0]);
  const merged = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i][0] <= last[1]) {
      last[1] = Math.max(last[1], sorted[i][1]);
    } else {
      merged.push(sorted[i]);
    }
  }

  return merged;
}

function generateIPAddresses(data) {
  const s = String(data);
  const results = [];

  for (let a = 1; a <= 3; a++) {
    for (let b = 1; b <= 3; b++) {
      for (let c = 1; c <= 3; c++) {
        const d = s.length - a - b - c;
        if (d < 1 || d > 3) continue;

        const parts = [
          s.slice(0, a),
          s.slice(a, a + b),
          s.slice(a + b, a + b + c),
          s.slice(a + b + c),
        ];

        if (parts.some(p => (p.length > 1 && p[0] === "0") || Number(p) > 255)) continue;
        results.push(parts.join("."));
      }
    }
  }

  return results;
}

function stockTraderI(prices) {
  let minPrice = Infinity;
  let maxProfit = 0;

  for (const price of prices) {
    minPrice = Math.min(minPrice, price);
    maxProfit = Math.max(maxProfit, price - minPrice);
  }

  return maxProfit;
}

function stockTraderII(prices) {
  let profit = 0;
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > prices[i - 1]) {
      profit += prices[i] - prices[i - 1];
    }
  }
  return profit;
}

function stockTraderIII(prices) {
  return stockTraderIV([2, prices]);
}

function stockTraderIV(data) {
  const k = data[0];
  const prices = data[1];

  if (prices.length === 0 || k <= 0) return 0;

  if (k >= Math.floor(prices.length / 2)) {
    return stockTraderII(prices);
  }

  const buy = Array(k + 1).fill(-Infinity);
  const sell = Array(k + 1).fill(0);

  for (const price of prices) {
    for (let i = 1; i <= k; i++) {
      buy[i] = Math.max(buy[i], sell[i - 1] - price);
      sell[i] = Math.max(sell[i], buy[i] + price);
    }
  }

  return sell[k];
}

function minPathTriangle(data) {
  const dp = [...data[data.length - 1]];
  for (let i = data.length - 2; i >= 0; i--) {
    for (let j = 0; j <= i; j++) {
      dp[j] = data[i][j] + Math.min(dp[j], dp[j + 1]);
    }
  }
  return dp[0];
}

function uniquePathsI(data) {
  const [m, n] = data;
  const dp = Array.from({ length: m }, () => Array(n).fill(1));

  for (let i = 1; i < m; i++) {
    for (let j = 1; j < n; j++) {
      dp[i][j] = dp[i - 1][j] + dp[i][j - 1];
    }
  }

  return dp[m - 1][n - 1];
}

function uniquePathsII(grid) {
  const m = grid.length;
  const n = grid[0].length;
  const dp = Array.from({ length: m }, () => Array(n).fill(0));

  dp[0][0] = grid[0][0] === 0 ? 1 : 0;

  for (let i = 1; i < m; i++) {
    dp[i][0] = grid[i][0] === 0 ? dp[i - 1][0] : 0;
  }
  for (let j = 1; j < n; j++) {
    dp[0][j] = grid[0][j] === 0 ? dp[0][j - 1] : 0;
  }

  for (let i = 1; i < m; i++) {
    for (let j = 1; j < n; j++) {
      dp[i][j] = grid[i][j] === 0 ? dp[i - 1][j] + dp[i][j - 1] : 0;
    }
  }

  return dp[m - 1][n - 1];
}

function shortestPathInGrid(grid) {
  const rows = grid.length;
  const cols = grid[0].length;

  if (grid[0][0] === 1 || grid[rows - 1][cols - 1] === 1) return "";

  const dirs = [
    [1, 0, "D"],
    [-1, 0, "U"],
    [0, 1, "R"],
    [0, -1, "L"],
  ];

  const queue = [[0, 0, ""]];
  const seen = new Set(["0,0"]);

  while (queue.length > 0) {
    const [x, y, path] = queue.shift();

    if (x === rows - 1 && y === cols - 1) return path;

    for (const [dx, dy, step] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;

      if (
        nx >= 0 && nx < rows &&
        ny >= 0 && ny < cols &&
        grid[nx][ny] === 0 &&
        !seen.has(key)
      ) {
        seen.add(key);
        queue.push([nx, ny, path + step]);
      }
    }
  }

  return "";
}

function sanitizeParentheses(data) {
  const results = new Set();
  const queue = [data];
  const visited = new Set([data]);
  let found = false;

  while (queue.length > 0) {
    const curr = queue.shift();

    if (isValidParenString(curr)) {
      results.add(curr);
      found = true;
    }

    if (found) continue;

    for (let i = 0; i < curr.length; i++) {
      if (curr[i] !== "(" && curr[i] !== ")") continue;
      const next = curr.slice(0, i) + curr.slice(i + 1);
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return [...results];
}

function isValidParenString(s) {
  let balance = 0;
  for (const c of s) {
    if (c === "(") balance++;
    else if (c === ")") {
      balance--;
      if (balance < 0) return false;
    }
  }
  return balance === 0;
}

function findAllValidMathExpressions(data) {
  const digits = data[0];
  const target = Number(data[1]);
  const results = [];

  function dfs(index, expr, value, prev) {
    if (index === digits.length) {
      if (value === target) results.push(expr);
      return;
    }

    for (let i = index; i < digits.length; i++) {
      if (i > index && digits[index] === "0") break;

      const part = digits.slice(index, i + 1);
      const n = Number(part);

      if (index === 0) {
        dfs(i + 1, part, n, n);
      } else {
        dfs(i + 1, `${expr}+${part}`, value + n, n);
        dfs(i + 1, `${expr}-${part}`, value - n, -n);
        dfs(i + 1, `${expr}*${part}`, value - prev + prev * n, prev * n);
      }
    }
  }

  dfs(0, "", 0, 0);
  return results;
}

function proper2Coloring(data) {
  const n = data[0];
  const edges = data[1];
  const graph = Array.from({ length: n }, () => []);

  for (const [a, b] of edges) {
    graph[a].push(b);
    graph[b].push(a);
  }

  const color = Array(n).fill(-1);

  for (let i = 0; i < n; i++) {
    if (color[i] !== -1) continue;

    color[i] = 0;
    const queue = [i];

    while (queue.length > 0) {
      const node = queue.shift();
      for (const next of graph[node]) {
        if (color[next] === -1) {
          color[next] = 1 - color[node];
          queue.push(next);
        } else if (color[next] === color[node]) {
          return [];
        }
      }
    }
  }

  return color;
}

function rleCompression(data) {
  if (data.length === 0) return "";

  let out = "";
  let count = 1;

  for (let i = 1; i <= data.length; i++) {
    if (i < data.length && data[i] === data[i - 1] && count < 9) {
      count++;
    } else {
      out += String(count) + data[i - 1];
      count = 1;
    }
  }

  return out;
}

function lzDecompression(data) {
  let i = 0;
  let out = "";
  let isLiteral = true;

  while (i < data.length) {
    const len = Number(data[i]);
    i++;

    if (len === 0) {
      isLiteral = !isLiteral;
      continue;
    }

    if (isLiteral) {
      out += data.slice(i, i + len);
      i += len;
    } else {
      const offset = Number(data[i]);
      i++;
      for (let j = 0; j < len; j++) {
        out += out[out.length - offset];
      }
    }

    isLiteral = !isLiteral;
  }

  return out;
}

function caesarCipher(data) {
  const text = data[0];
  const shift = Number(data[1]);
  let out = "";

  for (const ch of text) {
    if (ch === " ") {
      out += " ";
      continue;
    }
    const code = ch.charCodeAt(0) - 65;
    out += String.fromCharCode(((code - shift + 26) % 26) + 65);
  }

  return out;
}

function vigenereCipher(data) {
  const plaintext = data[0];
  const key = data[1];
  let out = "";

  for (let i = 0; i < plaintext.length; i++) {
    const p = plaintext.charCodeAt(i) - 65;
    const k = key.charCodeAt(i % key.length) - 65;
    out += String.fromCharCode(((p + k) % 26) + 65);
  }

  return out;
}

function hammingEncode(value) {
  const dataBits = Number(value).toString(2);
  const m = dataBits.length;

  let r = 0;
  while ((1 << r) < m + r + 1) {
    r++;
  }

  const totalLength = m + r + 1;
  const bits = Array(totalLength).fill("0");

  const parityPositions = new Set([0]);
  for (let p = 1; p < totalLength; p <<= 1) {
    parityPositions.add(p);
  }

  let di = 0;
  for (let i = 0; i < totalLength; i++) {
    if (!parityPositions.has(i)) {
      bits[i] = dataBits[di++] || "0";
    }
  }

  for (let p = 1; p < totalLength; p <<= 1) {
    let parity = 0;
    for (let i = 1; i < totalLength; i++) {
      if (i & p) parity ^= Number(bits[i]);
    }
    bits[p] = String(parity);
  }

  let overall = 0;
  for (let i = 1; i < totalLength; i++) {
    overall ^= Number(bits[i]);
  }
  bits[0] = String(overall);

  return bits.join("");
}

function hammingDecode(encoded) {
  const bits = String(encoded).split("");
  const n = bits.length;

  const parityPositions = new Set([0]);
  for (let p = 1; p < n; p <<= 1) {
    parityPositions.add(p);
  }

  let errorIndex = 0;

  for (let p = 1; p < n; p <<= 1) {
    let parity = 0;
    for (let i = 1; i < n; i++) {
      if (i & p) parity ^= Number(bits[i]);
    }
    if (parity !== 0) errorIndex += p;
  }

  let overallParity = 0;
  for (let i = 0; i < n; i++) {
    overallParity ^= Number(bits[i]);
  }

  if (overallParity !== 0) {
    if (errorIndex > 0 && errorIndex < n) {
      bits[errorIndex] = bits[errorIndex] === "0" ? "1" : "0";
    } else if (errorIndex === 0) {
      bits[0] = bits[0] === "0" ? "1" : "0";
    }
  }

  let dataBits = "";
  for (let i = 0; i < n; i++) {
    if (!parityPositions.has(i)) {
      dataBits += bits[i];
    }
  }

  return String(parseInt(dataBits || "0", 2));
}

function lzCompression(input) {
  const s = String(input);
  const n = s.length;
  const INF = 1e9;

  // dist[pos][type]
  // type 0 = next chunk must be literal
  // type 1 = next chunk must be backref
  const dist = Array.from({ length: n + 1 }, () => [INF, INF]);
  const prev = Array.from({ length: n + 1 }, () => [null, null]);

  dist[0][0] = 0;

  const heap = new MinHeap();
  heap.push([0, 0, 0]);

  while (!heap.isEmpty()) {
    const [cost, pos, type] = heap.pop();
    if (cost !== dist[pos][type]) continue;

    // zero-length chunk flips mode
    if (cost + 1 < dist[pos][1 - type]) {
      dist[pos][1 - type] = cost + 1;
      prev[pos][1 - type] = [pos, type, "0"];
      heap.push([cost + 1, pos, 1 - type]);
    }

    if (type === 0) {
      for (let len = 1; len <= 9 && pos + len <= n; len++) {
        const token = String(len) + s.slice(pos, pos + len);
        const nextCost = cost + 1 + len;
        if (nextCost < dist[pos + len][1]) {
          dist[pos + len][1] = nextCost;
          prev[pos + len][1] = [pos, type, token];
          heap.push([nextCost, pos + len, 1]);
        }
      }
    } else {
      for (let offset = 1; offset <= 9; offset++) {
        if (pos - offset < 0) continue;

        for (let len = 1; len <= 9 && pos + len <= n; len++) {
          if (!matchesReference(s, pos, len, offset)) break;

          const token = String(len) + String(offset);
          const nextCost = cost + 2;
          if (nextCost < dist[pos + len][0]) {
            dist[pos + len][0] = nextCost;
            prev[pos + len][0] = [pos, type, token];
            heap.push([nextCost, pos + len, 0]);
          }
        }
      }
    }
  }

  const endType = dist[n][0] <= dist[n][1] ? 0 : 1;
  if (dist[n][endType] >= INF) return "";

  const parts = [];
  let pos = n;
  let type = endType;

  while (!(pos === 0 && type === 0)) {
    const p = prev[pos][type];
    if (!p) return "";
    const [prevPos, prevType, token] = p;
    parts.push(token);
    pos = prevPos;
    type = prevType;
  }

  parts.reverse();
  return parts.join("");
}

function matchesReference(s, pos, len, offset) {
  for (let i = 0; i < len; i++) {
    if (s[pos + i] !== s[pos + i - offset]) return false;
  }
  return true;
}

class MinHeap {
  constructor() {
    this.data = [];
  }

  isEmpty() {
    return this.data.length === 0;
  }

  push(item) {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop() {
    if (this.data.length === 1) return this.data.pop();
    const top = this.data[0];
    this.data[0] = this.data.pop();
    this.bubbleDown(0);
    return top;
  }

  bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.data[parent][0] <= this.data[index][0]) break;
      [this.data[parent], this.data[index]] = [this.data[index], this.data[parent]];
      index = parent;
    }
  }

  bubbleDown(index) {
    const length = this.data.length;
    while (true) {
      let smallest = index;
      const left = index * 2 + 1;
      const right = index * 2 + 2;

      if (left < length && this.data[left][0] < this.data[smallest][0]) {
        smallest = left;
      }
      if (right < length && this.data[right][0] < this.data[smallest][0]) {
        smallest = right;
      }
      if (smallest === index) break;

      [this.data[index], this.data[smallest]] = [this.data[smallest], this.data[index]];
      index = smallest;
    }
  }
}
function sqrtBigInt(n) {
    if (n < 2n) return n;

    let x0 = n;
    let x1 = (x0 + 1n) >> 1n;

    while (x1 < x0) {
        x0 = x1;
        x1 = (x1 + n / x1) >> 1n;
    }

    return x0;
}
function sqrtNearest(n) {
    let x = sqrtBigInt(n);
    let lower = x * x;
    let upper = (x + 1n) * (x + 1n);

    return (n - lower <= upper - n) ? x : x + 1n;
}
function squareRoot(data) {
  const n = BigInt(data);

  if (n < 2n) return n.toString();

  let x = n;
  let y = (x + 1n) >> 1n;

  while (y < x) {
    x = y;
    y = (x + n / x) >> 1n;
  }

  return x.toString();
}