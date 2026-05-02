/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");

  if (!ns.singularity) {
    ns.tprint("PaggerOS: Singularity API not available.");
    return;
  }

  const alreadyHasTor = ns.hasTorRouter();

  if (alreadyHasTor) {
    ns.tprint("PaggerOS: TOR router already owned.");
    return;
  }

  const cost = 200000;

  if (ns.getPlayer().money < cost) {
    ns.tprint(`PaggerOS: Not enough money for TOR. Need $${ns.format.number(cost, 2)}.`);
    return;
  }

  const bought = ns.singularity.purchaseTor();

  if (bought) {
    ns.tprint("PaggerOS: TOR router purchased.");
  } else {
    ns.tprint("PaggerOS: TOR purchase failed.");
  }
}
