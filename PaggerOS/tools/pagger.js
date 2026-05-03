/** @param {NS} ns **/
export async function main(ns) {
    const script = "/PaggerOS/tools/cmd/farm.js";
    const target = ns.args[0];

    if (!script || !target) {
        ns.tprint("Usage: run pagger.js <target>");
        return;
    }

    // Recursively discover all servers from "home"
    function scanAll(current, visited = new Set()) {
        visited.add(current);
        for (const neighbor of ns.scan(current)) {
            if (!visited.has(neighbor)) {
                scanAll(neighbor, visited);
            }
        }
        return visited;
    }

    const allServers = [...scanAll("home")]
      .filter(s => s !== "home")
      .filter(s => !s.startsWith("tranny"));

    for (const server of allServers) {
        // Attempt to gain root access if we don't have it
        if (!ns.hasRootAccess(server)) {
            try {
                const ports = ns.getServerNumPortsRequired(server);
                if (ports >= 1) ns.brutessh(server);
                if (ports >= 2) ns.ftpcrack(server);
                if (ports >= 3) ns.relaysmtp(server);
                if (ports >= 4) ns.httpworm(server);
                if (ports >= 5) ns.sqlinject(server);
                ns.nuke(server);
            } catch {
                ns.tprint(`\x1b[31mCould not root ${server}, skipping.\x1b[0m`);
                continue;
            }
        }

        ns.killall(server);
        await ns.scp(script, server);

        const ramPerThread = ns.getScriptRam(script, server);
        const maxRam = ns.getServerMaxRam(server);
        const usedRam = ns.getServerUsedRam(server);
        const freeRam = maxRam - usedRam;
        const threads = Math.floor(freeRam / ramPerThread);

        if (threads > 0) {
            ns.exec(script, server, threads, target);
            ns.tprint(`\x1b[32mStarted ${script} on ${server} with ${threads} threads targeting ${target}\x1b[0m`);
        } else {
            ns.tprint(`\x1b[33mNot enough RAM on ${server} to run ${script}\x1b[0m`);
        }
    }
}