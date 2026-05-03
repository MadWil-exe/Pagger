const STATE_FILE = "/PaggerOS/status/corp-state.txt";
const STATUS_FILE = "/PaggerOS/status/corp.txt";

const STAGES = {
  NONE: "none",
  NEED_CORP: "need_corp",
  NEED_AGRI: "need_agriculture",
  NEED_ROUND1_RP: "need_round1_rp",
  NEED_ROUND1_BALANCE: "need_round1_balance",
  ROUND1_READY: "round1_ready",
};

const SCRIPTS = {
  [STAGES.NEED_CORP]: "/PaggerOS/corp/setup/buy-corp.js",
  [STAGES.NEED_AGRI]: "/PaggerOS/corp/setup/agriculture.js",
  [STAGES.NEED_ROUND1_RP]: "/PaggerOS/corp/setup/round1-rp.js",
  [STAGES.NEED_ROUND1_BALANCE]: "/PaggerOS/corp/setup/round1-balance.js",
};

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");

  while (true) {
    const stage = detectStage(ns);
    const script = SCRIPTS[stage];

    writeStatus(ns, {
      phase: stage,
      message: script ? `Router selected ${script}` : "No setup script required.",
    });

    if (script && !ns.isRunning(script, "home")) {
      const pid = ns.exec(script, "home", 1);

      writeStatus(ns, {
        phase: stage,
        message: pid > 0
          ? `Started ${script}`
          : `Failed to start ${script}`,
        pid,
      });
    }

    await ns.sleep(5000);
  }
}

/** @param {NS} ns **/
function detectStage(ns) {
  if (!ns.corporation) return STAGES.NONE;

  let corp;

  try {
    corp = ns.corporation.getCorporation();
  } catch {
    return STAGES.NEED_CORP;
  }

  if (!corp) return STAGES.NEED_CORP;

  const divisions = corp.divisions.map(d => typeof d === "string" ? d : d.name);

  if (!divisions.includes("Agriculture")) {
    return STAGES.NEED_AGRI;
  }

  const agri = ns.corporation.getDivision("Agriculture");

  if ((agri.researchPoints ?? 0) < 55) {
    return STAGES.NEED_ROUND1_RP;
  }

  const state = readState(ns);

  if (state.round1Balanced !== true) {
    return STAGES.NEED_ROUND1_BALANCE;
  }

  return STAGES.ROUND1_READY;
}

/** @param {NS} ns **/
function readState(ns) {
  try {
    if (!ns.fileExists(STATE_FILE, "home")) return {};
    const raw = ns.read(STATE_FILE);
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** @param {NS} ns **/
function writeStatus(ns, patch) {
  const payload = {
    module: "Corporation",
    updated: new Date().toISOString(),
    ...patch,
  };

  ns.write(STATUS_FILE, JSON.stringify(payload, null, 2), "w");
}