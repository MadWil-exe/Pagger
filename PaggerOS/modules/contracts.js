import { writeStatus } from "/PaggerOS/lib/status.js";

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");

  while (true) {
    const contracts = findContracts(ns);

    await writeStatus(ns, "Contracts", {
      state: "watching",
      contractsFound: contracts.length,
      solvedSupported: contracts.filter(c => c.hasSolver).length,
      missingSolvers: contracts.filter(c => !c.hasSolver).length,
      contracts,
      message: contracts.length === 0
        ? "No contracts found"
        : `${contracts.length} contract(s), ${contracts.filter(c => c.hasSolver).length} supported`,
    });

    await ns.sleep(5000);
  }
}

function findContracts(ns) {
  const servers = getAllServers(ns);
  const found = [];

  for (const server of servers) {
    for (const file of ns.ls(server, ".cct")) {
      const type = ns.codingcontract.getContractType(file, server);
      const hasSolver = SOLVER_REGISTRY.has(type);

      found.push({
        server,
        file,
        type,
        hasSolver,
      });
    }
  }

  return found.sort((a, b) => {
    if (a.hasSolver !== b.hasSolver) return a.hasSolver ? -1 : 1;
    return a.type.localeCompare(b.type);
  });
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

const SOLVER_REGISTRY = new Set([
  // Compression
  "Compression I: RLE Compression",
  "Compression II: LZ Decompression",
  "Compression III: LZ Compression",

  // Stock Trader
  "Algorithmic Stock Trader I",
  "Algorithmic Stock Trader II",
  "Algorithmic Stock Trader III",
  "Algorithmic Stock Trader IV",

  // Maths
  "Find Largest Prime Factor",
  "Total Number of Primes",
  "Total Ways to Sum",
  "Total Ways to Sum II",

  // Arrays / Dynamic Programming
  "Array Jumping Game",
  "Array Jumping Game II",
  "Subarray with Maximum Sum",
  "Merge Overlapping Intervals",
  "Largest Rectangle in a Matrix",

  // Grids / Paths
  "Shortest Path in a Grid",
  "Unique Paths in a Grid I",
  "Unique Paths in a Grid II",
  "Minimum Path Sum in a Triangle",

  // Matrix / Generation
  "Spiralize Matrix",
  "Generate IP Addresses",

  // Expressions / Graphs
  "Find All Valid Math Expressions",
  "Proper 2-Coloring of a Graph",

  // Hamming
  "HammingCodes: Integer to Encoded Binary",
  "HammingCodes: Encoded Binary to Integer",

  // Encryption
  "Encryption I: Caesar Cipher",
  "Encryption II: Vigenre Cipher",
]);
