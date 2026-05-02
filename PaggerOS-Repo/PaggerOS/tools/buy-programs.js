/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");

  if (!ns.hasTorRouter()) {
    ns.tprint("PaggerOS: No TOR router. Buy TOR first.");
    return;
  }

  const programs = [
    "BruteSSH.exe",
    "FTPCrack.exe",
    "relaySMTP.exe",
    "HTTPWorm.exe",
    "SQLInject.exe",
  ];

  for (const program of programs) {
    if (ns.fileExists(program, "home")) {
      ns.tprint(`PaggerOS: already owned ${program}`);
      continue;
    }

    const bought = ns.singularity.purchaseProgram(program);

    if (bought) {
      ns.tprint(`PaggerOS: bought ${program}`);
    } else {
      ns.tprint(`PaggerOS: could not buy ${program}`);
    }

    await ns.sleep(50);
  }
}
