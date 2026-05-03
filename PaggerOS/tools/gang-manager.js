/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();

  const SETTINGS = {
    // Training / role gates
    trainStatFloor: 400,
    warfareStatFloor: 700,

    // Wanted control
    penaltyHardFloor: 0.85,
    penaltySoftFloor: 0.95,

    // Territory
    desiredWarfareMembers: 0,
    minClashChanceToFight: 0.60,

    // Ascension
    ascendCombatMulti: 1.6,

    // Equipment
    equipmentReserve: 1e9,
    equipmentSpendFrac: 0.05,
  };

  if (!ns.gang.inGang()) {
    ns.tprint("Not in a gang.");
    return;
  }
  

  while (true) {
    recruitMembers(ns);

    let gang = ns.gang.getGangInformation();
    let members = getMembers(ns);

    maybeAscend(ns, members, SETTINGS);

    // Refresh after ascensions/recruitment
    gang = ns.gang.getGangInformation();
    members = getMembers(ns);

    buyEquipment(ns, members, SETTINGS.equipmentReserve, SETTINGS.equipmentSpendFrac);

    const wantedPenalty = gang.wantedPenalty;
    const memberCount = members.length;

    const sortedStrongest = [...members].sort((a, b) => combatScore(b) - combatScore(a));
    const sortedWeakest = [...members].sort((a, b) => combatScore(a) - combatScore(b));

    // Train everybody under the floor. No exceptions.
    const trainers = new Set(
      members
        .filter(m => combatScore(m) < SETTINGS.trainStatFloor)
        .map(m => m.name)
    );

    // Vigilante count depends on wanted penalty
    const vigilanteCount = chooseVigilanteCount(wantedPenalty, memberCount, SETTINGS);

    // Choose warfare candidates from strong members only
    let warfareCandidates = sortedStrongest.filter(
      m => !trainers.has(m.name) && combatScore(m) >= SETTINGS.warfareStatFloor
    );

    let warfareCount = chooseWarfareCount(wantedPenalty, memberCount, SETTINGS);
    warfareCount = Math.min(warfareCount, warfareCandidates.length);

    const warfareSet = new Set(
      warfareCandidates.slice(0, warfareCount).map(m => m.name)
    );

    // Vigilantes come from weakest non-trainers, non-warfare first
    const vigilanteSet = new Set();
    for (const m of sortedWeakest) {
      if (vigilanteSet.size >= vigilanteCount) break;
      if (trainers.has(m.name)) continue;
      if (warfareSet.has(m.name)) continue;
      vigilanteSet.add(m.name);
    }

    // Assign tasks
    for (const m of members) {
      let task = "Train Combat";

      if (trainers.has(m.name)) {
        task = bestTrainingTask(ns);
      } else if (vigilanteSet.has(m.name)) {
        task = "Vigilante Justice";
      } else if (warfareSet.has(m.name)) {
        task = "Territory Warfare";
      } else {
        task = pickBestMoneyTask(ns, m, wantedPenalty);
      }

      safeSetTask(ns, m.name, task);
    }

    const engage = shouldEngageClashes(ns, SETTINGS.minClashChanceToFight);
    ns.gang.setTerritoryWarfare(engage);

    printStatus(ns, gang, members, vigilanteSet, warfareSet, trainers, engage);

    await ns.gang.nextUpdate();
  }
}


function getMembers(ns) {
  return ns.gang.getMemberNames().map(name => ns.gang.getMemberInformation(name));
}

function recruitMembers(ns) {
  while (ns.gang.canRecruitMember()) {
    const name = nextRecruitName(ns);
    if (!ns.gang.recruitMember(name)) break;

    ns.print(`Recruited ${name}`);
    safeSetTask(ns, name, "Train Combat");
  }
}

function nextRecruitName(ns) {
  const existing = new Set(ns.gang.getMemberNames());
  let i = 1;
  while (existing.has(`Tranny-${i}`)) i++;
  return `Tranny-${i}`;
}

function maybeAscend(ns, members, settings) {
  for (const m of members) {
    const asc = ns.gang.getAscensionResult(m.name);
    if (!asc) continue;

    const bestCombatGain = Math.max(
      asc.str ?? 0,
      asc.def ?? 0,
      asc.dex ?? 0,
      asc.agi ?? 0
    );

    if (bestCombatGain >= settings.ascendCombatMulti) {
      if (ns.gang.ascendMember(m.name)) {
        ns.print(`Ascended ${m.name} (${bestCombatGain.toFixed(2)}x)`);
      }
    }
  }
}

function chooseVigilanteCount(wantedPenalty, memberCount, settings) {
  if (memberCount <= 2) return 0;

  const actualPenalty = 1 - wantedPenalty;

  if (actualPenalty >= 0.25) {
    return Math.max(1, memberCount - 1);
  }

  if (wantedPenalty < settings.penaltyHardFloor) {
    return Math.max(2, Math.ceil(memberCount * 0.6));
  }

  if (wantedPenalty < settings.penaltySoftFloor) {
    return 1;
  }

  return 0;
}

function chooseWarfareCount(wantedPenalty, memberCount, settings) {
  if (memberCount < 4) return 0;
  if (wantedPenalty < settings.penaltyHardFloor) return 0;
  if (wantedPenalty < settings.penaltySoftFloor) return 1;

  return Math.min(settings.desiredWarfareMembers, Math.max(1, Math.floor(memberCount)));
}

function getOtherGangInfo(ns) {
  if (typeof ns.gang.getAllGangInformation === "function") {
    return ns.gang.getAllGangInformation();
  }
  if (typeof ns.gang.getAllGangInformation === "function") {
    return ns.gang.getAllGangInformation();
  }
  return {};
}

function shouldEngageClashes(ns, minChance) {
  const all = getOtherGangInfo(ns);
  const myGang = ns.gang.getGangInformation().faction;

  let hasOpponent = false;

  for (const [name, info] of Object.entries(all)) {
    if (name === myGang) continue;
    if (!info || info.territory <= 0) continue;

    const chance = ns.gang.getChanceToWinClash(name);
    if (typeof chance !== "number" || Number.isNaN(chance)) continue;

    hasOpponent = true;
    if (chance < minChance) return false;
  }

  return hasOpponent;
}

function buyEquipment(ns, members, reserve = 1e9, spendFrac = 0.05) {
  const money = ns.getServerMoneyAvailable("home");
  const spendable = money * spendFrac;
  const budget = Math.max(0, spendable - reserve);
  if (budget <= 0) return;

  const equips = ns.gang.getEquipmentNames()
    .map(name => ({
      name,
      cost: ns.gang.getEquipmentCost(name),
      type: ns.gang.getEquipmentType(name),
    }))
    .filter(e => e.type !== "Rootkit")
    .sort((a, b) => a.cost - b.cost);

  let remaining = budget;

  for (const m of [...members].sort((a, b) => combatScore(a) - combatScore(b))) {
    const owned = new Set([...(m.upgrades || []), ...(m.augmentations || [])]);

    for (const e of equips) {
      if (owned.has(e.name)) continue;
      if (e.cost > remaining) continue;

      if (ns.gang.purchaseEquipment(m.name, e.name)) {
        remaining -= e.cost;
        owned.add(e.name);
        ns.print(`Bought ${e.name} for ${m.name}`);
      }
    }
  }
}

function bestTrainingTask(ns) {
  const names = ns.gang.getTaskNames();
  const prefs = ["Train Combat", "Train Hacking", "Train Charisma"];
  for (const p of prefs) {
    if (names.includes(p)) return p;
  }
  return "Unassigned";
}

function pickBestMoneyTask(ns, member, wantedPenalty = 1) {
  const gangInfo = ns.gang.getGangInformation();
  const isHackingGang = gangInfo.isHacking;

  const lowWantedMode = wantedPenalty < 0.95;

  return isHackingGang
    ? pickBestHackingMoneyTask(ns, member, lowWantedMode)
    : pickBestCombatMoneyTask(ns, member, lowWantedMode);
}

function pickBestCombatMoneyTask(ns, member, lowWantedMode = false) {
  const power = combatScore(member);

  if (power < 500) {
    return pickFirstAvailable(ns, [
      "Strongarm Civilians",
      "Mug People",
      "Run a Con",
    ]);
  }

  if (power < 800) {
    return pickFirstAvailable(ns, lowWantedMode
      ? ["Run a Con", "Armed Robbery", "Strongarm Civilians"]
      : ["Armed Robbery", "Run a Con", "Strongarm Civilians"]
    );
  }

  if (power < 1200) {
    return pickFirstAvailable(ns, lowWantedMode
      ? ["Armed Robbery", "Traffick Illegal Arms", "Threaten & Blackmail"]
      : ["Traffick Illegal Arms", "Armed Robbery", "Threaten & Blackmail"]
    );
  }

  if (power < 1800) {
    return pickFirstAvailable(ns, lowWantedMode
      ? ["Traffick Illegal Arms", "Threaten & Blackmail", "Human Trafficking"]
      : ["Human Trafficking", "Traffick Illegal Arms", "Threaten & Blackmail"]
    );
  }

  return pickFirstAvailable(ns, lowWantedMode
    ? ["Threaten & Blackmail", "Traffick Illegal Arms", "Human Trafficking"]
    : ["Human Trafficking", "Traffick Illegal Arms", "Threaten & Blackmail"]
  );
}

function pickBestHackingMoneyTask(ns, member, lowWantedMode = false) {
  const power = hackingScore(member);

  if (power < 100) {
    return pickFirstAvailable(ns, [
      "Ransomware",
      "Phishing",
    ]);
  }

  if (power < 250) {
    return pickFirstAvailable(ns, lowWantedMode
      ? ["Phishing", "Ransomware", "Identity Theft"]
      : ["Identity Theft", "Ransomware", "Phishing"]
    );
  }

  if (power < 500) {
    return pickFirstAvailable(ns, lowWantedMode
      ? ["Identity Theft", "DDoS Attacks", "Plant Virus"]
      : ["DDoS Attacks", "Identity Theft", "Plant Virus"]
    );
  }

  if (power < 900) {
    return pickFirstAvailable(ns, lowWantedMode
      ? ["DDoS Attacks", "Plant Virus", "Fraud & Counterfeiting"]
      : ["Fraud & Counterfeiting", "Plant Virus", "DDoS Attacks"]
    );
  }

  if (power < 1400) {
    return pickFirstAvailable(ns, lowWantedMode
      ? ["Plant Virus", "Fraud & Counterfeiting", "Money Laundering"]
      : ["Money Laundering", "Fraud & Counterfeiting", "Plant Virus"]
    );
  }

  return pickFirstAvailable(ns, lowWantedMode
    ? ["Money Laundering", "Fraud & Counterfeiting", "Cyberterrorism"]
    : ["Cyberterrorism", "Money Laundering", "Fraud & Counterfeiting"]
  );
}

function combatScore(member) {
  return (
    member.str +
    member.def +
    member.dex +
    member.agi
  ) / 4;
}

function hackingScore(member) {
  // Charisma helps some gang tasks, but hacking is the big one.
  return member.hack + member.cha * 0.25;
}

function pickFirstAvailable(ns, taskNames) {
  for (const task of taskNames) {
    try {
      ns.gang.getTaskStats(task);
      return task;
    } catch {
      // Task does not exist in this gang/type/version. Ignore it.
    }
  }

  return "Train Hacking";
}

function safeSetTask(ns, memberName, task) {
  try {
    ns.gang.setMemberTask(memberName, task);
  } catch (err) {
    ns.print(`Failed to set ${memberName} to ${task}: ${String(err)}`);
  }
}

function printStatus(ns, gang, members, vigilantes, warfare, trainers, engage) {
  ns.clearLog();
  ns.print("=== GANG MANAGER ===");
  ns.print(`Faction: ${gang.faction}`);
  ns.print(`Members: ${members.length}`);
  ns.print(`Respect: ${formatNum(gang.respect)}`);
  ns.print(`Wanted: ${formatNum(gang.wantedLevel)} | Penalty: ${(gang.wantedPenalty * 100).toFixed(2)}%`);
  ns.print(`Power: ${formatNum(gang.power)} | Territory: ${(gang.territory * 100).toFixed(2)}%`);
  ns.print(`Clashes: ${engage ? "ON" : "OFF"}`);
  ns.print("");

  for (const m of [...members].sort((a, b) => combatScore(b) - combatScore(a))) {
    let role = "Money";
    if (warfare.has(m.name)) role = "Warfare";
    else if (vigilantes.has(m.name)) role = "Vigilante";
    else if (trainers.has(m.name)) role = "Training";

    ns.print(
      `${m.name.padEnd(12)} | ${role.padEnd(10)} | ` +
      `combat=${String(Math.round(combatScore(m))).padStart(5)} | ` +
      `task=${m.task}`
    );
  }
}

function formatNum(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "t";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "b";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "m";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "k";
  return n.toFixed(2);
}
