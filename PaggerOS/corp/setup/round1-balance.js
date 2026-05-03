const DIVISION = "Agriculture";

const CITIES = [
  "Sector-12",
  "Aevum",
  "Volhaven",
  "Chongqing",
  "New Tokyo",
  "Ishima",
];

const STATUS_FILE = "/PaggerOS/status/corp.txt";
const STATE_FILE = "/PaggerOS/status/corp-state.txt";

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");

  for (const city of CITIES) {
    try {
      ns.corporation.setAutoJobAssignment(DIVISION, city, "Research & Development", 0);
      ns.corporation.setAutoJobAssignment(DIVISION, city, "Operations", 1);
      ns.corporation.setAutoJobAssignment(DIVISION, city, "Engineer", 1);
      ns.corporation.setAutoJobAssignment(DIVISION, city, "Business", 1);
      ns.corporation.setAutoJobAssignment(DIVISION, city, "Management", 1);
    } catch {}
  }

  updateState(ns, {
    round1Balanced: true,
  });

  writeStatus(ns, {
    phase: "round1_balanced",
    message: "Round 1 jobs balanced: Ops 1, Eng 1, Bus 1, Mgmt 1.",
  });
}

function updateState(ns, patch) {
  let state = {};

  try {
    if (ns.fileExists(STATE_FILE, "home")) {
      const raw = ns.read(STATE_FILE);
      state = raw.trim() ? JSON.parse(raw) : {};
    }
  } catch {}

  state = {
    ...state,
    ...patch,
    updated: new Date().toISOString(),
  };

  ns.write(STATE_FILE, JSON.stringify(state, null, 2), "w");
}

function writeStatus(ns, patch) {
  ns.write(STATUS_FILE, JSON.stringify({
    module: "Corporation",
    updated: new Date().toISOString(),
    ...patch,
  }, null, 2), "w");
}
