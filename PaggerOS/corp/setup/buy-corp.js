const CORP_NAME = "TrannyCorp";
const STATUS_FILE = "/PaggerOS/status/corp.txt";
const STATE_FILE = "/PaggerOS/status/corp-state.txt";

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");

  try {
    ns.corporation.createCorporation(CORP_NAME, true);

    updateState(ns, {
      corporationCreated: true,
      corporationName: CORP_NAME,
    });

    writeStatus(ns, {
      phase: "corp_created",
      message: `Created corporation: ${CORP_NAME}`,
    });
  } catch (err) {
    writeStatus(ns, {
      phase: "corp_create_failed",
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
  } catch {
    state = {};
  }

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