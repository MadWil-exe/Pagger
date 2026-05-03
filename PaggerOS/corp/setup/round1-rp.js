const DIVISION = "Agriculture";
const TARGET_RP = 55;

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

  while (true) {
    const div = ns.corporation.getDivision(DIVISION);
    const rp = div.researchPoints ?? 0;

    if (rp >= TARGET_RP) {
      updateState(ns, {
        round1RpComplete: true,
        agricultureRp: rp,
      });

      writeStatus(ns, {
        phase: "round1_rp_complete",
        message: `Agriculture has ${rp.toFixed(2)} RP. Ready to balance jobs.`,
        rp,
      });

      return;
    }

    for (const city of CITIES) {
      keepHappy(ns, DIVISION, city);

      try {
        ns.corporation.setAutoJobAssignment(DIVISION, city, "Operations", 0);
        ns.corporation.setAutoJobAssignment(DIVISION, city, "Engineer", 0);
        ns.corporation.setAutoJobAssignment(DIVISION, city, "Business", 0);
        ns.corporation.setAutoJobAssignment(DIVISION, city, "Management", 0);
        ns.corporation.setAutoJobAssignment(DIVISION, city, "Research & Development", 4);
      } catch {}
    }

    writeStatus(ns, {
      phase: "round1_rp",
      message: `Waiting for ${TARGET_RP} RP.`,
      rp,
      targetRp: TARGET_RP,
    });

    await ns.sleep(10000);
  }
}

function keepHappy(ns, division, city) {
  try {
    const office = ns.corporation.getOffice(division, city);

    if (office.avgEnergy < 99) {
      ns.corporation.buyTea(division, city);
    }

    if (office.avgMorale < 99) {
      ns.corporation.throwParty(division, city, 500000);
    }
  } catch {}
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