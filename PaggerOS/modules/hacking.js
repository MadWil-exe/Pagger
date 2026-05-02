import { writeStatus } from "/PaggerOS/lib/status.js";

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");

  while (true) {
    try {
      const status = buildHackingStatus(ns);
      await writeStatus(ns, "Hacking", status);
    } catch (err) {
      await writeStatus(ns, "Hacking", {
        state: "error",
        message: String(err),
      });
    }

    await ns.sleep(5000);
  }
}

function buildHackingStatus(ns) {
  const player = ns.getPlayer();
  const servers = getAllServers(ns);
  const purchased = ns.cloud.getServerNames();

  const rooted = servers.filter(s => ns.hasRootAccess(s)).length;
  const hackable = servers.filter(s => {
    return ns.hasRootAccess(s)
      && ns.getServerRequiredHackingLevel(s) <= player.skills.hacking
      && ns.getServerMaxMoney(s) > 0;
  });

  const targets = hackable
    .map(s => {
      const maxMoney = ns.getServerMaxMoney(s);
      const money = ns.getServerMoneyAvailable(s);
      const minSec = ns.getServerMinSecurityLevel(s);
      const sec = ns.getServerSecurityLevel(s);

      return {
        server: s,
        maxMoney,
        money,
        moneyPct: maxMoney > 0 ? money / maxMoney : 0,
        minSec,
        sec,
        secDelta: sec - minSec,
        requiredHack: ns.getServerRequiredHackingLevel(s),
        growth: ns.getServerGrowth(s),
      };
    })
    .sort((a, b) => b.maxMoney - a.maxMoney)
    .slice(0, 10);

  const pservs = purchased.map(s => {
    const server = ns.getServer(s);

    return {
      name: s,
      maxRam: server.maxRam,
      usedRam: server.ramUsed,
      freeRam: server.maxRam - server.ramUsed,
      usedPct: server.maxRam > 0 ? server.ramUsed / server.maxRam : 0,
    };
  }).sort((a, b) => b.maxRam - a.maxRam);

  const totalPservRam = pservs.reduce((sum, s) => sum + s.maxRam, 0);
  const usedPservRam = pservs.reduce((sum, s) => sum + s.usedRam, 0);

  const home = ns.getServer("home");

  return {
    state: "watching",
    message: `${pservs.length} pserv(s), ${hackable.length} hackable target(s)`,

    hacking: player.skills.hacking,

    serversSeen: servers.length,
    rooted,
    hackable: hackable.length,

    homeMaxRam: home.maxRam,
    homeUsedRam: home.ramUsed,
    homeFreeRam: home.maxRam - home.ramUsed,

    purchasedCount: pservs.length,
    purchasedLimit: ns.cloud.getServerLimit(),
    purchasedMaxRam: ns.cloud.getRamLimit(),

    totalPservRam,
    usedPservRam,
    freePservRam: totalPservRam - usedPservRam,

    pservs: pservs.slice(0, 25),
    targets,
  };
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
