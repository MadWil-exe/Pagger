import { writeStatus } from "/PaggerOS/lib/status.js";

const MANAGER_SCRIPT = "/PaggerOS/tools/gang-manager.js";

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");

  while (true) {
    try {
      const hasGang = ns.gang.inGang();

      if (!hasGang) {
        await writeStatus(ns, "Gang", {
          state: "locked",
          message: "Not in a gang yet",
          inGang: false,
          running: false,
          members: 0,
          respect: 0,
          wanted: 0,
          wantedPenalty: 1,
          territory: 0,
          power: 0,
        });

        await ns.sleep(5000);
        continue;
      }

      const running = ns.isRunning(MANAGER_SCRIPT, "home");

      if (!running) {
        const pid = ns.run(MANAGER_SCRIPT, 1);

        await writeStatus(ns, "Gang", {
          state: pid === 0 ? "error" : "starting",
          message: pid === 0
            ? `Could not start ${MANAGER_SCRIPT}`
            : `Started gang manager as PID ${pid}`,
          inGang: true,
          running: pid !== 0,
        });

        await ns.sleep(5000);
        continue;
      }

      const info = ns.gang.getGangInformation();
      const members = ns.gang.getMemberNames();

      const wantedPenalty = info.wantedPenalty ?? 1;
      const respect = info.respect ?? 0;
      const wanted = info.wantedLevel ?? 0;
      const territory = info.territory ?? 0;
      const power = info.power ?? 0;

      await writeStatus(ns, "Gang", {
        state: "watching",
        message: `${members.length} member(s), ${(wantedPenalty * 100).toFixed(2)}% wanted penalty`,
        inGang: true,
        running: true,
        faction: info.faction,
        members: members.length,
        respect,
        wanted,
        wantedPenalty,
        territory,
        power,
      });
    } catch (err) {
      await writeStatus(ns, "Gang", {
        state: "error",
        message: String(err),
      });
    }

    await ns.sleep(3000);
  }
}
