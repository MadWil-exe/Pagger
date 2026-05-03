import { writeStatus } from "/PaggerOS/lib/status.js";

const STATUS_FILE = "corp.txt";
const AUTO_SCRIPT = "/PaggerOS/corp/corp-auto.js";

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");

  const status = {
    module: "Corporation",
    enabled: true,
    hasApi: false,
    hasCorp: false,
    daemon: "stopped",
    message: "",
    updated: new Date().toISOString(),
  };

  try {
    if (!ns.corporation || typeof ns.corporation.getCorporation !== "function") {
      status.message = "Corporation API unavailable. Need Corp unlock / BitNode access.";
      writeStatus(ns, STATUS_FILE, status);
      return;
    }

    status.hasApi = true;

    let corp = null;

    try {
      corp = ns.corporation.getCorporation();
      status.hasCorp = !!corp;
    } catch {
      status.hasCorp = false;
      status.message = "Corp API available, but no corporation exists yet.";
    }

    if (status.hasCorp) {
      status.message = `Corporation detected: ${corp.name}`;
    }

    const running = ns.isRunning(AUTO_SCRIPT, "home");

    if (!running) {
      const pid = ns.exec(AUTO_SCRIPT, "home", 1);

      if (pid > 0) {
        status.daemon = "started";
        status.message += " Corp daemon launched.";
      } else {
        status.daemon = "failed";
        status.message += " Failed to launch corp daemon.";
      }
    } else {
      status.daemon = "running";
      status.message += " Corp daemon already running.";
    }

    writeStatus(ns, STATUS_FILE, status);
  } catch (err) {
    status.message = `Corp module error: ${String(err)}`;
    writeStatus(ns, STATUS_FILE, status);
  }
}