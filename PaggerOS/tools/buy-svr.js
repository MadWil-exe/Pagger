/** @param {NS} ns **/
export async function main(ns) {
    const ram = 2;
    const limit = ns.cloud.getServerLimit();

    let i = 0;

    while (i < limit) {
        const cost = ns.cloud.getServerCost(ram);

        if (ns.getServerMoneyAvailable("home") >= cost) {
            const group = Math.floor(i / 5) + 1;
            const member = (i % 5) + 1;
            const serverName = `tranny-g${group}-${member}`;

            const hostname = ns.cloud.purchaseServer(serverName, ram);

            if (hostname) {
                ns.tprint(`Bought ${hostname} - Lost the cock, kept the beard....`);
                i++;
            } else {
                ns.tprint(`${serverName} has multiple personalities.....`);
                return
            }
        }

        await ns.sleep(1000);
    }
}
