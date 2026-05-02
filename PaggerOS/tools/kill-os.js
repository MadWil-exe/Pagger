// /os/tools/kill-os.js

/** @param {NS} ns **/
export async function main(ns) {
  const scripts = [
    "/os/kernel.js",
    "/os/modules/hack.js",
    "/os/modules/contracts.js",
    "/os/modules/gang.js",
    "/os/modules/stock.js",
    "/os/modules/corp.js",
    "/os/modules/sleeves.js",
    "/os/modules/bladeburner.js",
    "/os/modules/ipvgo.js",
  ];

  for (const script of scripts) {
    ns.scriptKill(script, "home");
  }

  ns.tprint("PaggerOS stopped. The tranny has been contained.");
}
