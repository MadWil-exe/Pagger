/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");

  const dryRun = ns.args.includes("--dry");
  const servers = getAllServers(ns);
  const contracts = [];

  for (const server of servers) {
    for (const file of ns.ls(server, ".cct")) {
      const type = ns.codingcontract.getContractType(file, server);
      const data = ns.codingcontract.getData(file, server);
      const solver = SOLVERS[type];

      contracts.push({ server, file, type, data, solver });
    }
  }

  if (contracts.length === 0) {
    ns.tprint("No contracts found.");
    return;
  }

  for (const contract of contracts) {
    const { server, file, type, data, solver } = contract;

    if (!solver) {
      ns.tprint(`SKIP: ${server}/${file} | ${type} | no solver`);
      continue;
    }

    let rawAnswer;
    let answer;

    try {
      rawAnswer = solver(data);
      answer = formatContractAnswer(type, rawAnswer);
    } catch (err) {
      ns.tprint(`ERROR: ${server}/${file} | ${type}`);
      ns.tprint(String(err));
      continue;
    }

    if (dryRun) {
      ns.tprint(`DRY: ${server}/${file} | ${type}`);
      ns.tprint(`Data: ${JSON.stringify(data)}`);
      ns.tprint(`Raw Answer: ${JSON.stringify(rawAnswer)} | typeof=${typeof rawAnswer}`);
      ns.tprint(`Submit Answer: ${JSON.stringify(answer)} | typeof=${typeof answer}`);
      continue;
    }

    ns.tprint(`TRY: ${server}/${file} | ${type}`);
    ns.tprint(`Data: ${JSON.stringify(data)}`);
    ns.tprint(`Raw Answer: ${JSON.stringify(rawAnswer)} | typeof=${typeof rawAnswer}`);
    ns.tprint(`Submit Answer: ${JSON.stringify(answer)} | typeof=${typeof answer}`);

    const reward = ns.codingcontract.attempt(answer, file, server, {
      returnReward: true,
    });

    if (reward) {
      ns.tprint(`SOLVED: ${server}/${file} | ${type}`);
      ns.tprint(`Reward: ${reward}`);

      await writeSolveHistory(ns, {
        outcome: "solved",
        server,
        file,
        type,
        reward,
      });
    } else {
      ns.tprint(`FAILED: ${server}/${file} | ${type}`);
      ns.tprint(`Answer tried: ${JSON.stringify(answer)}`);

      await writeSolveHistory(ns, {
        outcome: "failed",
        server,
        file,
        type,
        answer,
      });
    }
  }
}

function getAllServers(ns) {
  const seen = new Set(["home"]);
  const queue = ["home"];

  while (queue.length > 0) {
    const host = queue.shift();

    for (const next of ns.scan(host)) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }

  return [...seen];
}

const SOLVERS = {
  // Compression
  "Compression I: RLE Compression": solveRLE,

  // Stock Trader
  "Algorithmic Stock Trader I": solveStockTraderI,
  "Algorithmic Stock Trader II": solveStockTraderII,
  "Algorithmic Stock Trader III": solveStockTraderIII,
  "Algorithmic Stock Trader IV": solveStockTraderIV,

  // Hamming
  "HammingCodes: Encoded Binary to Integer": solveHammingDecode,

  // Grids / paths
  "Shortest Path in a Grid": solveShortestPathGrid,
  "Unique Paths in a Grid I": solveUniquePathsI,
  "Unique Paths in a Grid II": solveUniquePathsII,
  "Minimum Path Sum in a Triangle": solveTriangleMinPath,

  // Arrays
  "Array Jumping Game": solveArrayJumpingGame,
  "Array Jumping Game II": solveArrayJumpingGameII,
  "Merge Overlapping Intervals": solveMergeIntervals,
  "Largest Rectangle in a Matrix": solveLargestRectangleInAMatrix,

  // Maths
  "Total Number of Primes": solveTotalNumberOfPrimes,

  // Encryption
  "Encryption I: Caesar Cipher": solveCaesarCipher,
  "Encryption II: VigenÃ¨re Cipher": solveVigenereCipher,
  "Proper 2-Coloring of a Graph": solveProperTwoColoring,
  // Other common contracts, useful while you are here
  "Find Largest Prime Factor": solveLargestPrimeFactor,
  "Subarray with Maximum Sum": solveMaxSubarray,
  "Spiralize Matrix": solveSpiralizeMatrix,
  "Generate IP Addresses": solveGenerateIPs,
  "Total Ways to Sum": solveTotalWaysToSum,
  "Total Ways to Sum II": solveTotalWaysToSumII,
};

// ------------------------------------------------------------
// Compression I: RLE Compression
// ------------------------------------------------------------

function solveRLE(data) {
  let out = "";
  let i = 0;

  while (i < data.length) {
    const ch = data[i];
    let count = 1;

    while (i + count < data.length && data[i + count] === ch && count < 9) {
      count++;
    }

    out += `${count}${ch}`;
    i += count;
  }

  return out;
}

// ------------------------------------------------------------
// Algorithmic Stock Trader I-IV
// ------------------------------------------------------------
function solveStockTraderI(prices) {
  return maxProfitWithKTransactions(1, prices);
}

function solveStockTraderII(prices) {
  let profit = 0;

  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > prices[i - 1]) {
      profit += prices[i] - prices[i - 1];
    }
  }

  return profit;
}

function solveStockTraderIII(prices) {
  return maxProfitWithKTransactions(2, prices);
}

function solveStockTraderIV(data) {
  const maxTransactions = data[0];
  const prices = data[1];

  return maxProfitWithKTransactions(maxTransactions, prices);
}

function maxProfitWithKTransactions(k, prices) {
  if (!Array.isArray(prices) || prices.length < 2 || k <= 0) return 0;

  // If k is effectively unlimited, use the simple greedy version.
  if (k >= Math.floor(prices.length / 2)) {
    return solveStockTraderII(prices);
  }

  const buy = Array(k + 1).fill(-Infinity);
  const sell = Array(k + 1).fill(0);

  for (const price of prices) {
    for (let t = 1; t <= k; t++) {
      buy[t] = Math.max(buy[t], sell[t - 1] - price);
      sell[t] = Math.max(sell[t], buy[t] + price);
    }
  }

  return sell[k];
}

// ------------------------------------------------------------
// HammingCodes: Encoded Binary to Integer
// ------------------------------------------------------------

function solveHammingDecode(data) {
  const bits = data.split("").map(Number);

  let errorPos = 0;

  // Bit 0 is the overall parity bit.
  // Parity bits are at 1, 2, 4, 8...
  for (let p = 1; p < bits.length; p <<= 1) {
    let parity = 0;

    for (let i = p; i < bits.length; i++) {
      if (i & p) parity ^= bits[i];
    }

    if (parity !== 0) errorPos += p;
  }

  const overallParity = bits.reduce((a, b) => a ^ b, 0);

  if (errorPos > 0 && overallParity === 1) {
    bits[errorPos] ^= 1;
  } else if (errorPos === 0 && overallParity === 1) {
    bits[0] ^= 1;
  }

  let binary = "";

  for (let i = 1; i < bits.length; i++) {
    if ((i & (i - 1)) !== 0) {
      binary += bits[i];
    }
  }

  return parseInt(binary || "0", 2);
}

// ------------------------------------------------------------
// Shortest Path in a Grid
// ------------------------------------------------------------

function solveShortestPathGrid(grid) {
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
  const seen = Array.from({ length: rows }, () => Array(cols).fill(false));
  seen[0][0] = true;

  while (queue.length > 0) {
    const [r, c, path] = queue.shift();

    if (r === rows - 1 && c === cols - 1) {
      return path;
    }

    for (const [dr, dc, move] of dirs) {
      const nr = r + dr;
      const nc = c + dc;

      if (
        nr >= 0 &&
        nr < rows &&
        nc >= 0 &&
        nc < cols &&
        !seen[nr][nc] &&
        grid[nr][nc] === 0
      ) {
        seen[nr][nc] = true;
        queue.push([nr, nc, path + move]);
      }
    }
  }

  return "";
}

// ------------------------------------------------------------
// Unique Paths
// ------------------------------------------------------------

function solveUniquePathsI(data) {
  const [rows, cols] = data;
  const dp = Array(cols).fill(1);

  for (let r = 1; r < rows; r++) {
    for (let c = 1; c < cols; c++) {
      dp[c] += dp[c - 1];
    }
  }

  return dp[cols - 1];
}

function solveUniquePathsII(grid) {
  const rows = grid.length;
  const cols = grid[0].length;

  const dp = Array(cols).fill(0);
  dp[0] = grid[0][0] === 0 ? 1 : 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 1) {
        dp[c] = 0;
      } else if (c > 0) {
        dp[c] += dp[c - 1];
      }
    }
  }

  return dp[cols - 1];
}

// ------------------------------------------------------------
// Minimum Path Sum in a Triangle
// ------------------------------------------------------------

function solveTriangleMinPath(triangle) {
  const dp = triangle[triangle.length - 1].slice();

  for (let r = triangle.length - 2; r >= 0; r--) {
    for (let c = 0; c < triangle[r].length; c++) {
      dp[c] = triangle[r][c] + Math.min(dp[c], dp[c + 1]);
    }
  }

  return dp[0];
}

// ------------------------------------------------------------
// Array Jumping Game I / II
// ------------------------------------------------------------

function solveArrayJumpingGame(data) {
  let reach = 0;

  for (let i = 0; i <= reach && i < data.length; i++) {
    reach = Math.max(reach, i + data[i]);
    if (reach >= data.length - 1) return 1;
  }

  return 0;
}

function solveArrayJumpingGameII(data) {
  if (data.length <= 1) return 0;

  let jumps = 0;
  let currentEnd = 0;
  let farthest = 0;

  for (let i = 0; i < data.length - 1; i++) {
    farthest = Math.max(farthest, i + data[i]);

    if (i === currentEnd) {
      jumps++;
      currentEnd = farthest;

      if (currentEnd >= data.length - 1) return jumps;
      if (currentEnd === i) return 0;
    }
  }

  return 0;
}

// ------------------------------------------------------------
// Merge Overlapping Intervals
// ------------------------------------------------------------

function solveMergeIntervals(intervals) {
  if (intervals.length === 0) return [];

  intervals.sort((a, b) => a[0] - b[0]);

  const merged = [intervals[0].slice()];

  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1];
    const current = intervals[i];

    if (current[0] <= last[1]) {
      last[1] = Math.max(last[1], current[1]);
    } else {
      merged.push(current.slice());
    }
  }

  return merged;
}

// ------------------------------------------------------------
// Largest Rectangle in a Matrix
// ------------------------------------------------------------

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

function largestRectangleInHistogram(heights) {
  const stack = [];
  let best = 0;

  for (let i = 0; i <= heights.length; i++) {
    const h = i === heights.length ? 0 : heights[i];

    while (stack.length > 0 && h < heights[stack[stack.length - 1]]) {
      const height = heights[stack.pop()];
      const left = stack.length > 0 ? stack[stack.length - 1] : -1;
      const width = i - left - 1;

      best = Math.max(best, height * width);
    }

    stack.push(i);
  }

  return best;
}

// ------------------------------------------------------------
// Total Number of Primes
// ------------------------------------------------------------

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

// ------------------------------------------------------------
// Encryption I: Caesar Cipher
// ------------------------------------------------------------

function solveCaesarCipher(data) {
  const [text, shift] = data;
  const s = shift % 26;

  return text
    .split("")
    .map(ch => {
      if (ch < "A" || ch > "Z") return ch;

      const code = ch.charCodeAt(0) - 65;
      return String.fromCharCode(((code - s + 26) % 26) + 65);
    })
    .join("");
}

// ------------------------------------------------------------
// Encryption II: VigenÃ¨re Cipher
// ------------------------------------------------------------

function solveVigenereCipher(data) {
  const [text, keyword] = data;
  let out = "";

  for (let i = 0; i < text.length; i++) {
    const plain = text.charCodeAt(i) - 65;
    const key = keyword.charCodeAt(i % keyword.length) - 65;
    out += String.fromCharCode(((plain + key) % 26) + 65);
  }

  return out;
}

// ------------------------------------------------------------
// Find Largest Prime Factor
// ------------------------------------------------------------

function solveLargestPrimeFactor(n) {
  let factor = 2;
  let lastFactor = 1;

  while (factor * factor <= n) {
    if (n % factor === 0) {
      lastFactor = factor;
      n = Math.floor(n / factor);

      while (n % factor === 0) {
        n = Math.floor(n / factor);
      }
    }

    factor += factor === 2 ? 1 : 2;
  }

  return n > 1 ? n : lastFactor;
}

// ------------------------------------------------------------
// Subarray with Maximum Sum
// ------------------------------------------------------------

function solveMaxSubarray(data) {
  let best = data[0];
  let current = data[0];

  for (let i = 1; i < data.length; i++) {
    current = Math.max(data[i], current + data[i]);
    best = Math.max(best, current);
  }

  return best;
}

// ------------------------------------------------------------
// Spiralize Matrix
// ------------------------------------------------------------

function solveSpiralizeMatrix(matrix) {
  const result = [];

  let top = 0;
  let bottom = matrix.length - 1;
  let left = 0;
  let right = matrix[0].length - 1;

  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) result.push(matrix[top][c]);
    top++;

    for (let r = top; r <= bottom; r++) result.push(matrix[r][right]);
    right--;

    if (top <= bottom) {
      for (let c = right; c >= left; c--) result.push(matrix[bottom][c]);
      bottom--;
    }

    if (left <= right) {
      for (let r = bottom; r >= top; r--) result.push(matrix[r][left]);
      left++;
    }
  }

  return result;
}

// ------------------------------------------------------------
// Generate IP Addresses
// ------------------------------------------------------------

function solveGenerateIPs(data) {
  const result = [];

  function valid(part) {
    if (part.length === 0 || part.length > 3) return false;
    if (part.length > 1 && part[0] === "0") return false;
    return Number(part) <= 255;
  }

  for (let a = 1; a <= 3; a++) {
    for (let b = 1; b <= 3; b++) {
      for (let c = 1; c <= 3; c++) {
        for (let d = 1; d <= 3; d++) {
          if (a + b + c + d !== data.length) continue;

          const p1 = data.slice(0, a);
          const p2 = data.slice(a, a + b);
          const p3 = data.slice(a + b, a + b + c);
          const p4 = data.slice(a + b + c);

          if ([p1, p2, p3, p4].every(valid)) {
            result.push(`${p1}.${p2}.${p3}.${p4}`);
          }
        }
      }
    }
  }

  return result;
}

// ------------------------------------------------------------
// Total Ways to Sum
// ------------------------------------------------------------

function solveTotalWaysToSum(n) {
  const dp = Array(n + 1).fill(0);
  dp[0] = 1;

  for (let num = 1; num < n; num++) {
    for (let sum = num; sum <= n; sum++) {
      dp[sum] += dp[sum - num];
    }
  }

  return dp[n];
}

// ------------------------------------------------------------
// Total Ways to Sum II
// ------------------------------------------------------------

function solveTotalWaysToSumII(data) {
  const target = data[0];
  const nums = data[1];

  const dp = Array(target + 1).fill(0);
  dp[0] = 1;

  for (const num of nums) {
    for (let sum = num; sum <= target; sum++) {
      dp[sum] += dp[sum - num];
    }
  }

  return dp[target];
}



async function writeSolveHistory(ns, result) {
  const path = "/PaggerOS/status/contracts-history.txt";

  let history = [];

  if (ns.fileExists(path, "home")) {
    try {
      history = JSON.parse(ns.read(path));
    } catch {
      history = [];
    }
  }

  history.unshift({
    ...result,
    time: Date.now(),
  });

  history = history.slice(0, 20);

  await ns.write(path, JSON.stringify(history, null, 2), "w");
}



function formatContractAnswer(type, answer) {
  switch (type) {
    case "Largest Rectangle in a Matrix":
    case "Merge Overlapping Intervals":
    case "Spiralize Matrix":
    case "Generate IP Addresses":
    case "Sanitize Parentheses in Expression":
    case "Find All Valid Math Expressions":
      return JSON.stringify(answer);

    default:
      return answer;
  }
}

function solveProperTwoColoring(data) {
  const nodeCount = data[0];
  const edges = data[1];

  const colours = Array(nodeCount).fill(-1);
  const graph = Array.from({ length: nodeCount }, () => []);

  for (const [a, b] of edges) {
    graph[a].push(b);
    graph[b].push(a);
  }

  for (let start = 0; start < nodeCount; start++) {
    if (colours[start] !== -1) continue;

    colours[start] = 0;
    const queue = [start];

    while (queue.length > 0) {
      const node = queue.shift();

      for (const neighbour of graph[node]) {
        if (colours[neighbour] === -1) {
          colours[neighbour] = 1 - colours[node];
          queue.push(neighbour);
        } else if (colours[neighbour] === colours[node]) {
          return [];
        }
      }
    }
  }

  return colours;
}
