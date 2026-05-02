/**
 * Group attack controller with:
 * - auto target picking
 * - thread calculation
 * - keep-alive behaviour
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");

  const WORKERS = {
    hack: "workers/hack.js",
    grow: "workers/grow.js",
    weaken: "workers/weaken.js",
  };

  // Edit server names to match yours
  const GROUPS = [
    {
      name: "G1",
      mode: "xp",
      servers: ["tranny-g1-1", "tranny-g1-2", "tranny-g1-3", "tranny-g1-4", "tranny-g1-5"],
    },
    {
      name: "G2",
      mode: "money",
      servers: ["tranny-g2-1", "tranny-g2-2", "tranny-g2-3", "tranny-g2-4", "tranny-g2-5"],
    },
    {
      name: "G3",
      mode: "money",
      servers: ["tranny-g3-1", "tranny-g3-2", "tranny-g3-3", "tranny-g3-4", "tranny-g3-5"],
    },
    {
      name: "G4",
      mode: "money",
      servers: ["tranny-g4-1", "tranny-g4-2", "tranny-g4-3", "tranny-g4-4", "tranny-g4-5"],
    },
    {
      name: "G5",
      mode: "money",
      servers: ["tranny-g5-1", "tranny-g5-2", "tranny-g5-3", "tranny-g5-4", "tranny-g5-5"],
    },
  ];

  const SETTINGS = {
    loopDelay: 3000,
    securityBuffer: 2,
    moneyThreshold: 0.90,
    reserveHomeRam: 64,
    minServerRamToUse: 2,
    maxTargets: 5, // for G2-G5
  };

  for (const group of GROUPS) {
    for (const server of group.servers) {
      if (ns.serverExists(server)) {
        await ns.scp(Object.values(WORKERS), server, "home");
      }
    }
  }

  while (true) {
    ns.clearLog();
    ns.print("=== Group Auto Controller ===");

    const moneyTargets = pickBestTargets(ns, SETTINGS.maxTargets);

    let moneyIndex = 0;
    for (const group of GROUPS) {
      if (group.kind === "xp") {
        handleXpGroup(ns, group, WORKERS);
        continue;
      }

      const fallbackTargets = moneyTargets.length > 0 ? moneyTargets : ["n00dles"];
      const target = fallbackTargets[moneyIndex] || fallbackTargets[moneyIndex % fallbackTargets.length];

      group.target = target;
      handleMoneyGroup(ns, group, WORKERS, SETTINGS);
      moneyIndex++;
    }

    await ns.sleep(SETTINGS.loopDelay);
  }
}

function handleXpGroup(ns, group, workers) {
  const target = group.target;
  const sec = ns.getServerSecurityLevel(target);
  const minSec = ns.getServerMinSecurityLevel(target);

  // Mostly hack for XP, with weaken support when needed
  let plan;
  if (sec > minSec + 3) {
    plan = [
      { role: "weaken", weight: 1 },
      { role: "weaken", weight: 1 },
      { role: "weaken", weight: 1 },
      { role: "weaken", weight: 1 },
      { role: "weaken", weight: 1 },
    ];
  } else {
    plan = [
      { role: "hack", weight: 1 },
      { role: "hack", weight: 1 },
      { role: "hack", weight: 1 },
      { role: "hack", weight: 1 },
      { role: "weaken", weight: 1 },
    ];
  }

  deployWeightedPlan(ns, group, target, plan, workers);

  ns.print(
    `${group.name} [XP] -> ${target} | sec ${sec.toFixed(2)}/${minSec.toFixed(2)}`
  );
}

function handleMoneyGroup(ns, group, workers, settings) {
  const target = group.target;

  const money = ns.getServerMoneyAvailable(target);
  const maxMoney = ns.getServerMaxMoney(target);
  const sec = ns.getServerSecurityLevel(target);
  const minSec = ns.getServerMinSecurityLevel(target);

  const secTooHigh = sec > minSec + settings.securityBuffer;
  const moneyTooLow = maxMoney <= 0 ? true : money < maxMoney * settings.moneyThreshold;

  let plan;
  let mode;

  if (secTooHigh) {
    mode = "WEAKEN";
    plan = [
      { role: "weaken", weight: 1 },
      { role: "weaken", weight: 1 },
      { role: "weaken", weight: 1 },
      { role: "weaken", weight: 1 },
      { role: "weaken", weight: 1 },
    ];
  } else if (moneyTooLow) {
    mode = "GROW";
    plan = [
      { role: "grow", weight: 3 },
      { role: "grow", weight: 3 },
      { role: "grow", weight: 3 },
      { role: "weaken", weight: 2 },
      { role: "weaken", weight: 2 },
    ];
  } else {
    mode = "FARM";
    plan = [
      { role: "hack", weight: 1 },
      { role: "grow", weight: 2 },
      { role: "grow", weight: 2 },
      { role: "weaken", weight: 2 },
      { role: "weaken", weight: 2 },
    ];
  }

  deployWeightedPlan(ns, group, target, plan, workers);

  ns.print(
    `${group.name} [${mode}] -> ${target} | $${fmt(money)}/$${fmt(maxMoney)} | sec ${sec.toFixed(2)}/${minSec.toFixed(2)}`
  );
}

function deployWeightedPlan(ns, group, target, plan, workers) {
  for (let i = 0; i < group.servers.length; i++) {
    const server = group.servers[i];
    const entry = plan[i] || { role: "weaken", weight: 1 };
    const script = workers[entry.role];

    if (!ns.serverExists(server)) continue;

    ensureDesiredJob(ns, server, script, target);
  }
}

function ensureDesiredJob(ns, server, script, target) {
  const procs = ns.ps(server);

  const alreadyCorrect = procs.some(
    p => p.filename === script && String(p.args[0]) === target
  );
  if (alreadyCorrect) return;

  for (const p of procs) {
    if (
      p.filename === "workers/hack.js" ||
      p.filename === "workers/grow.js" ||
      p.filename === "workers/weaken.js"
    ) {
      ns.kill(p.pid);
    }
  }

  const freeRam = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
  const ramPerThread = ns.getScriptRam(script, server);
  if (ramPerThread <= 0) return;

  const threads = Math.floor(freeRam / ramPerThread);
  if (threads < 1) return;

  ns.exec(script, server, threads, target);
}

function idleGroup(ns, group) {
  for (const server of group.servers) {
    if (!ns.serverExists(server)) continue;
    for (const p of ns.ps(server)) {
      if (
        p.filename === "workers/hack.js" ||
        p.filename === "workers/grow.js" ||
        p.filename === "workers/weaken.js"
      ) {
        ns.kill(p.pid);
      }
    }
  }
}

function pickBestTargets(ns, count) {
  const rooted = scanAll(ns)
    .filter(s => ns.hasRootAccess(s))
    .filter(s => !s.startsWith("tranny")) // avoid your tranny groups if named g1-1 etc.
    .filter(s => s !== "home")
    .filter(s => ns.getServerMaxMoney(s) > 0)
    .filter(s => ns.getServerRequiredHackingLevel(s) <= ns.getHackingLevel())
    .filter(s => ns.getServerMaxRam(s) >= 0);

  const scored = rooted.map(host => ({
    host,
    score: scoreTarget(ns, host),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, count).map(x => x.host);
}

function scoreTarget(ns, host) {
  const maxMoney = ns.getServerMaxMoney(host);
  const minSec = ns.getServerMinSecurityLevel(host);
  const hackChance = ns.hackAnalyzeChance(host);
  const weakenTime = ns.getWeakenTime(host);

  if (maxMoney <= 0 || hackChance <= 0) return 0;

  // crude but effective:
  // more money good, high chance good, lower min sec good, shorter weaken time good
  return (maxMoney * hackChance) / (minSec * Math.max(1, weakenTime));
}

function scanAll(ns) {
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

function fmt(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "t";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "b";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "m";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "k";
  return n.toFixed(0);
}