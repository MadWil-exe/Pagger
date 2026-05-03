/** @param {NS} ns **/
export async function main(ns) {
  const ramLevels = [
    8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384,
    32768, 65536, 131072, 262144, 524288, 1048576
  ];

  const budgetPercent = 0.50;
  const ownedServers = ns.cloud.getServerNames();

  for (const server of ownedServers) {
    const currentRam = ns.getServerMaxRam(server);
    const nextRam = ramLevels.find(r => r > currentRam);

    if (!nextRam) {
      continue;
    }

    const money = ns.getPlayer().money;
    const budget = money * budgetPercent;
    const cost = ns.cloud.getServerUpgradeCost(server, nextRam);

    if (cost <= budget) {
      const upgraded = ns.cloud.upgradeServer(server, nextRam);

      if (upgraded) {
        ns.tprint(`\x1b[32mUpgraded ${server} from ${currentRam} Genders to ${nextRam} Genders for $${ns.format.number(cost)}\x1b[0m`);
      }
    }
  }

}
