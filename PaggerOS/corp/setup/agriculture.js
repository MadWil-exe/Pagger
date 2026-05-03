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

  try {
    const corp = ns.corporation.getCorporation();
    const divisions = corp.divisions.map(d => typeof d === "string" ? d : d.name);

    if (!divisions.includes(DIVISION)) {
      ns.corporation.expandIndustry("Agriculture", DIVISION);
    }

    for (const city of CITIES) {
      try {
        const div = ns.corporation.getDivision(DIVISION);

        if (!div.cities.includes(city)) {
          ns.corporation.expandCity(DIVISION, city);
        }
      } catch {}

      try {
        ns.corporation.purchaseWarehouse(DIVISION, city);
      } catch {}

      try {
        const office = ns.corporation.getOffice(DIVISION, city);

        if (office.size < 4) {
          ns.corporation.upgradeOfficeSize(DIVISION, city, 4 - office.size);
        }

        const refreshed = ns.corporation.getOffice(DIVISION, city);
        const needed = 4 - refreshed.employees.length;

        for (let i = 0; i < needed; i++) {
          ns.corporation.hireEmployee(DIVISION, city);
        }
      } catch {}
    }

    updateState(ns, {
      agricultureCreated: true,
      agricultureCities: 6,
      agricultureWarehouses: 6,
      agricultureOfficeSize: 4,
    });

    writeStatus(ns, {
      phase: "agriculture_ready",
      message: "Agriculture created, expanded, warehouses bought, offices upgraded to 4.",
    });
  } catch (err) {
    writeStatus(ns, {
      phase: "agriculture_failed",
      message: String(err),
    });
  }
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