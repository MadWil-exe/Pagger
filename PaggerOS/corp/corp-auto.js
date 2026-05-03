const CORP_NAME = "PaggerCorp";

const DIVS = {
  AGRI: "Agriculture",
  CHEM: "Chemical",
  TOBACCO: "Tobacco",
};

const INDUSTRIES = {
  AGRI: "Agriculture",
  CHEM: "Chemical",
  TOBACCO: "Tobacco",
};

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

const ROUND_1_AGRI_RP_TARGET = 55;
const ROUND_2_AGRI_RP_TARGET = 700;
const ROUND_2_CHEM_RP_TARGET = 390;

const MAIN_CITY = "Sector-12";

const SLEEP_MS = 5000;

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");

  while (true) {
    try {
      await corpTick(ns);
    } catch (err) {
      logStatus(ns, {
        phase: "error",
        message: String(err),
      });
    }

    await ns.sleep(SLEEP_MS);
  }
}

/** @param {NS} ns **/
async function corpTick(ns) {
  const corpApi = ns.corporation;

  if (!corpApi || typeof corpApi.getCorporation !== "function") {
    logStatus(ns, {
      phase: "locked",
      message: "Corporation API is not available.",
    });
    return;
  }

  let corp = getCorpSafe(ns);

  if (!corp) {
    await createCorpIfPossible(ns);
    return;
  }

  maintainEmployees(ns);

  const state = readState(ns);

  if (!hasDivision(ns, DIVS.AGRI)) {
    await setupAgriculture(ns);
    saveState(ns, { stage: "round1_agri_setup" });
    return;
  }

  await maintainAgricultureSales(ns);

  if (getDivisionRP(ns, DIVS.AGRI) < ROUND_1_AGRI_RP_TARGET && state.stage !== "round1_jobs_balanced") {
    await setAllCitiesJobs(ns, DIVS.AGRI, {
      "Operations": 0,
      "Engineer": 0,
      "Business": 0,
      "Management": 0,
      "Research & Development": 4,
    });

    logStatus(ns, {
      phase: "round1",
      division: DIVS.AGRI,
      message: `Waiting for ${ROUND_1_AGRI_RP_TARGET} Agriculture RP.`,
      rp: getDivisionRP(ns, DIVS.AGRI),
    });

    return;
  }

  if (state.stage !== "round1_jobs_balanced") {
    await setAllCitiesJobs(ns, DIVS.AGRI, {
      "Operations": 1,
      "Engineer": 1,
      "Business": 1,
      "Management": 1,
      "Research & Development": 0,
    });

    saveState(ns, { stage: "round1_jobs_balanced" });
    return;
  }

  await buySmartSupplyOrFallback(ns);
  await round1StorageAndBoosts(ns);

  if (shouldStartRound2(ns)) {
    saveState(ns, { stage: "round2_start" });
  }

  if (readState(ns).stage === "round2_start" || readState(ns).stage?.startsWith("round2")) {
    await round2(ns);
    return;
  }

  logStatus(ns, {
    phase: "round1",
    message: "Round 1 automation active. Building Agriculture foundation.",
    funds: getCorpSafe(ns)?.funds ?? 0,
    revenue: getCorpSafe(ns)?.revenue ?? 0,
    expenses: getCorpSafe(ns)?.expenses ?? 0,
    agriRp: getDivisionRP(ns, DIVS.AGRI),
  });
}

/** @param {NS} ns **/
async function createCorpIfPossible(ns) {
  try {
    ns.corporation.createCorporation(CORP_NAME, true);

    logStatus(ns, {
      phase: "create",
      message: `Created corporation ${CORP_NAME}.`,
    });
  } catch (err) {
    logStatus(ns, {
      phase: "waiting",
      message: `No corporation yet. Waiting for unlock/funds. ${String(err)}`,
    });
  }
}

/** @param {NS} ns **/
async function setupAgriculture(ns) {
  if (!hasDivision(ns, DIVS.AGRI)) {
    ns.corporation.expandIndustry(INDUSTRIES.AGRI, DIVS.AGRI);
  }

  for (const city of CITIES) {
    ensureCity(ns, DIVS.AGRI, city);
    ensureWarehouse(ns, DIVS.AGRI, city);
    ensureOfficeSize(ns, DIVS.AGRI, city, 4);
    ensureEmployees(ns, DIVS.AGRI, city, 4);
  }

  logStatus(ns, {
    phase: "round1",
    message: "Agriculture created, expanded to all cities, warehouses bought, offices upgraded to 4.",
  });
}

/** @param {NS} ns **/
async function round1StorageAndBoosts(ns) {
  safeLevelUpgrade(ns, "Smart Storage", 1);

  for (const city of CITIES) {
    safeUpgradeWarehouse(ns, DIVS.AGRI, city, 1);
  }

  safeHireAdVert(ns, DIVS.AGRI, 2);

  // Early boost material trickle.
  // This intentionally uses buyMaterial per second, not bulk purchase.
  for (const city of CITIES) {
    safeBuyMaterial(ns, DIVS.AGRI, city, "Real Estate", 50);
    safeBuyMaterial(ns, DIVS.AGRI, city, "Hardware", 2);
    safeBuyMaterial(ns, DIVS.AGRI, city, "AI Cores", 1);
    safeBuyMaterial(ns, DIVS.AGRI, city, "Robots", 0.2);
  }

  logStatus(ns, {
    phase: "round1",
    message: "Round 1: Smart Storage / warehouses / adverts / boost material trickle active.",
  });
}

/** @param {NS} ns **/
async function round2(ns) {
  saveState(ns, { stage: "round2_running" });

  safeUnlock(ns, "Export");

  for (const city of CITIES) {
    ensureOfficeSize(ns, DIVS.AGRI, city, 8);
    ensureEmployees(ns, DIVS.AGRI, city, 8);
    safeUpgradeWarehouse(ns, DIVS.AGRI, city, 3);
  }

  safeHireAdVert(ns, DIVS.AGRI, 8);

  if (!hasDivision(ns, DIVS.CHEM)) {
    ns.corporation.expandIndustry(INDUSTRIES.CHEM, DIVS.CHEM);

    for (const city of CITIES) {
      ensureCity(ns, DIVS.CHEM, city);
      ensureWarehouse(ns, DIVS.CHEM, city);
      safeUpgradeWarehouse(ns, DIVS.CHEM, city, 1);
      ensureEmployees(ns, DIVS.CHEM, city, 3);
    }
  }

  await setAllCitiesJobs(ns, DIVS.AGRI, {
    "Operations": 2,
    "Engineer": 3,
    "Business": 1,
    "Management": 1,
    "Research & Development": 1,
  });

  await setAllCitiesJobs(ns, DIVS.CHEM, {
    "Operations": 1,
    "Engineer": 1,
    "Business": 0,
    "Management": 0,
    "Research & Development": 1,
  });

  await maintainAgricultureSales(ns);
  await maintainChemicalSales(ns);
  await setupRound2Exports(ns);

  safeLevelUpgrade(ns, "Smart Storage", 1);
  safeLevelUpgrade(ns, "Smart Factories", 1);

  const agriRp = getDivisionRP(ns, DIVS.AGRI);
  const chemRp = getDivisionRP(ns, DIVS.CHEM);

  if (agriRp >= ROUND_2_AGRI_RP_TARGET && chemRp >= ROUND_2_CHEM_RP_TARGET) {
    saveState(ns, { stage: "ready_for_tobacco" });

    logStatus(ns, {
      phase: "round2_complete",
      message: "Round 2 RP targets met. Ready for Tobacco hand-off.",
      agriRp,
      chemRp,
    });

    return;
  }

  logStatus(ns, {
    phase: "round2",
    message: "Round 2 active. Building Agriculture/Chemical RP and quality loop.",
    agriRp,
    chemRp,
    agriTarget: ROUND_2_AGRI_RP_TARGET,
    chemTarget: ROUND_2_CHEM_RP_TARGET,
  });
}

/** @param {NS} ns **/
async function setupRound2Exports(ns) {
  if (!hasUnlock(ns, "Export")) return;
  if (!hasDivision(ns, DIVS.AGRI) || !hasDivision(ns, DIVS.CHEM)) return;

  for (const city of CITIES) {
    safeExport(ns, DIVS.AGRI, city, DIVS.CHEM, city, "Plants", "(IPROD+IINV/10)");
    safeExport(ns, DIVS.CHEM, city, DIVS.AGRI, city, "Chemicals", "(IPROD+IINV/10)");
  }
}

/** @param {NS} ns **/
async function maintainAgricultureSales(ns) {
  for (const city of CITIES) {
    safeSellMaterial(ns, DIVS.AGRI, city, "Plants", "MAX", "MP");
    safeSellMaterial(ns, DIVS.AGRI, city, "Food", "MAX", "MP");
  }
}

/** @param {NS} ns **/
async function maintainChemicalSales(ns) {
  for (const city of CITIES) {
    safeSellMaterial(ns, DIVS.CHEM, city, "Chemicals", "MAX", "MP");
  }
}

/** @param {NS} ns **/
async function buySmartSupplyOrFallback(ns) {
  if (hasUnlock(ns, "Smart Supply")) {
    for (const div of [DIVS.AGRI, DIVS.CHEM]) {
      if (!hasDivision(ns, div)) continue;

      for (const city of CITIES) {
        safeSetSmartSupply(ns, div, city, true);
      }
    }

    return;
  }

  safeUnlock(ns, "Smart Supply");

  // Poor man's Smart Supply fallback.
  // This is deliberately conservative. It keeps divisions alive without blowing the warehouse to hell.
  for (const city of CITIES) {
    safeBuyMaterial(ns, DIVS.AGRI, city, "Water", 5);
    safeBuyMaterial(ns, DIVS.AGRI, city, "Chemicals", hasDivision(ns, DIVS.CHEM) ? 0 : 1);
  }

  if (hasDivision(ns, DIVS.CHEM)) {
    for (const city of CITIES) {
      safeBuyMaterial(ns, DIVS.CHEM, city, "Plants", 3);
      safeBuyMaterial(ns, DIVS.CHEM, city, "Water", 3);
    }
  }
}

/** @param {NS} ns **/
function maintainEmployees(ns) {
  for (const divName of getDivisionNames(ns)) {
    for (const city of CITIES) {
      try {
        const office = ns.corporation.getOffice(divName, city);

        if (office.avgEnergy < 99) {
          ns.corporation.buyTea(divName, city);
        }

        if (office.avgMorale < 99) {
          ns.corporation.throwParty(divName, city, 500000);
        }
      } catch {
        // City/division may not exist yet.
      }
    }
  }
}

/** @param {NS} ns **/
async function setAllCitiesJobs(ns, divName, jobs) {
  for (const city of CITIES) {
    for (const [job, count] of Object.entries(jobs)) {
      safeSetJob(ns, divName, city, job, count);
    }
  }
}

/** @param {NS} ns **/
function ensureCity(ns, divName, city) {
  try {
    const div = ns.corporation.getDivision(divName);

    if (!div.cities.includes(city)) {
      ns.corporation.expandCity(divName, city);
    }
  } catch {
    // Ignore.
  }
}

/** @param {NS} ns **/
function ensureWarehouse(ns, divName, city) {
  try {
    ns.corporation.getWarehouse(divName, city);
  } catch {
    try {
      ns.corporation.purchaseWarehouse(divName, city);
    } catch {
      // Not enough funds or already exists.
    }
  }
}

/** @param {NS} ns **/
function ensureOfficeSize(ns, divName, city, targetSize) {
  try {
    const office = ns.corporation.getOffice(divName, city);

    if (office.size < targetSize) {
      ns.corporation.upgradeOfficeSize(divName, city, targetSize - office.size);
    }
  } catch {
    // Ignore.
  }
}

/** @param {NS} ns **/
function ensureEmployees(ns, divName, city, targetEmployees) {
  try {
    const office = ns.corporation.getOffice(divName, city);

    while (office.employees.length < targetEmployees) {
      ns.corporation.hireEmployee(divName, city);
      const refreshed = ns.corporation.getOffice(divName, city);

      if (refreshed.employees.length === office.employees.length) break;

      office.employees = refreshed.employees;
    }
  } catch {
    // Ignore.
  }
}

/** @param {NS} ns **/
function shouldStartRound2(ns) {
  const corp = getCorpSafe(ns);
  if (!corp) return false;

  const state = readState(ns);
  if (state.stage?.startsWith("round2") || state.stage === "ready_for_tobacco") return true;

  // Conservative auto-trigger.
  // You can replace this with investment-offer logic later.
  return hasUnlock(ns, "Export") || corp.funds > 100e9;
}

/** @param {NS} ns **/
function safeUnlock(ns, name) {
  try {
    if (!hasUnlock(ns, name)) {
      ns.corporation.unlockUpgrade(name);
    }
  } catch {
    // Too expensive or unavailable.
  }
}

/** @param {NS} ns **/
function safeLevelUpgrade(ns, name, maxAttempts = 1) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      ns.corporation.levelUpgrade(name);
    } catch {
      return;
    }
  }
}

/** @param {NS} ns **/
function safeHireAdVert(ns, divName, targetLevel) {
  try {
    const div = ns.corporation.getDivision(divName);
    const current = div.numAdVerts ?? div.awareness ?? 0;

    for (let i = current; i < targetLevel; i++) {
      try {
        ns.corporation.hireAdVert(divName);
      } catch {
        return;
      }
    }
  } catch {
    // Ignore.
  }
}

/** @param {NS} ns **/
function safeUpgradeWarehouse(ns, divName, city, levels = 1) {
  for (let i = 0; i < levels; i++) {
    try {
      ns.corporation.upgradeWarehouse(divName, city);
    } catch {
      return;
    }
  }
}

/** @param {NS} ns **/
function safeBuyMaterial(ns, divName, city, material, amount) {
  try {
    ns.corporation.buyMaterial(divName, city, material, amount);
  } catch {
    // Ignore.
  }
}

/** @param {NS} ns **/
function safeSellMaterial(ns, divName, city, material, amount, price) {
  try {
    ns.corporation.sellMaterial(divName, city, material, amount, price);
  } catch {
    // Ignore.
  }
}

/** @param {NS} ns **/
function safeSetSmartSupply(ns, divName, city, enabled) {
  try {
    ns.corporation.setSmartSupply(divName, city, enabled);
  } catch {
    // Ignore.
  }
}

/** @param {NS} ns **/
function safeSetJob(ns, divName, city, job, count) {
  try {
    ns.corporation.setAutoJobAssignment(divName, city, job, count);
  } catch {
    // Ignore.
  }
}

/** @param {NS} ns **/
function safeExport(ns, sourceDiv, sourceCity, targetDiv, targetCity, material, amount) {
  try {
    ns.corporation.exportMaterial(
      sourceDiv,
      sourceCity,
      targetDiv,
      targetCity,
      material,
      amount,
    );
  } catch {
    // Usually already exists, Export not unlocked, or insufficient setup.
  }
}

/** @param {NS} ns **/
function hasUnlock(ns, name) {
  try {
    return ns.corporation.hasUnlockUpgrade(name);
  } catch {
    return false;
  }
}

/** @param {NS} ns **/
function getCorpSafe(ns) {
  try {
    return ns.corporation.getCorporation();
  } catch {
    return null;
  }
}

/** @param {NS} ns **/
function hasDivision(ns, divName) {
  return getDivisionNames(ns).includes(divName);
}

/** @param {NS} ns **/
function getDivisionNames(ns) {
  const corp = getCorpSafe(ns);
  if (!corp || !corp.divisions) return [];

  return corp.divisions.map(d => {
    if (typeof d === "string") return d;
    return d.name;
  });
}

/** @param {NS} ns **/
function getDivisionRP(ns, divName) {
  try {
    const div = ns.corporation.getDivision(divName);
    return div.researchPoints ?? div.rp ?? 0;
  } catch {
    return 0;
  }
}

/** @param {NS} ns **/
function readState(ns) {
  try {
    if (!ns.fileExists(STATE_FILE, "home")) return {};
    const raw = ns.read(STATE_FILE);
    if (!raw.trim()) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** @param {NS} ns **/
function saveState(ns, patch) {
  const current = readState(ns);
  const next = {
    ...current,
    ...patch,
    updated: new Date().toISOString(),
  };

  ns.write(STATE_FILE, JSON.stringify(next, null, 2), "w");
}

/** @param {NS} ns **/
function logStatus(ns, data) {
  const corp = getCorpSafe(ns);

  const payload = {
    module: "Corporation",
    updated: new Date().toISOString(),
    corp: corp?.name ?? null,
    funds: corp?.funds ?? 0,
    revenue: corp?.revenue ?? 0,
    expenses: corp?.expenses ?? 0,
    profit: corp ? corp.revenue - corp.expenses : 0,
    divisions: getDivisionNames(ns),
    state: readState(ns),
    ...data,
  };

  ns.write(STATUS_FILE, JSON.stringify(payload, null, 2), "w");
}