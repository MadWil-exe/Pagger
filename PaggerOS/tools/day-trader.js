/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");

    if (ns.args[0] === "sellall") {
        ns.tprint("=== LIQUIDATING ALL POSITIONS ===");
        let total = 0;
        for (const sym of ns.stock.getSymbols()) {
            try {
                const pos = ns.stock.getPosition(sym);
                if (pos[0] > 0) {
                    const bid    = ns.stock.getBidPrice(sym);
                    const profit = (bid - pos[1]) * pos[0] - 200000;
                    ns.stock.sellStock(sym, pos[0]);
                    total += profit;
                    ns.tprint(`\x1b[32m  SOLD  ${sym}: ${profit >= 0 ? "+" : ""}$${ns.format.number(profit)}\x1b[0m`);
                }
                if (pos[2] > 0) {
                    try {
                        const ask    = ns.stock.getAskPrice(sym);
                        const profit = (pos[3] - ask) * pos[2] - 200000;
                        ns.stock.sellShort(sym, pos[2]);
                        total += profit;
                        ns.tprint(`  COVER ${sym}: ${profit >= 0 ? "+" : ""}$${ns.format.number(profit)}`);
                    } catch { }
                }
            } catch { }
        }
        ns.tprint(`Total realised: $${ns.format.number(total)}`);
        ns.tprint(" Safe to install augments!");
        return;
    }

    if (!ns.stock.hasTixApiAccess()) {
        ns.tprint("ERROR: No TIX API. Buy from Stock Market page ($5b)");
        return;
    }

    const has4S = ns.stock.has4SDataTixApi();

    const CFG = {
        BUY_4S:         0.54,   // aggressive  buy at 54% forecast
        SELL_4S:        0.50,
        SHORT_4S:       0.46,   // aggressive short at 46%
        COVER_4S:       0.50,
        MAX_VOL:        0.07,   // allow slightly more volatility
        BUY_MOM:        0.002,  // momentum threshold to buy
        SELL_MOM:      -0.001,
        SHORT_MOM:     -0.002,
        COVER_MOM:      0.001,
        BUDGET_RATIO:   0.60,   // invest 60% of available cash
        PER_STOCK:      0.20,   // 20% of budget per stock
        CASH_FLOOR:     5e6,
        PROFIT_TAKE:    0.10,   // take profit at 12% of net worth
        LOSS_CUT:       5,      // cut at 5x commission
        COMMISSION:     100000,
        HISTORY:        14,
        MIN_HIST:       4,
        TICK:           6000,
    };

    const hist       = {};
    let realised     = 0;
    let trades       = 0;
    let buys         = 0;
    let sells        = 0;
    let shorts       = 0;
    let loopN        = 0;
    let peakPort     = 0;
    const startMoney = ns.getPlayer().money;
    const startTime  = Date.now();

    function portfolio() {
        let val = 0;
        for (const sym of ns.stock.getSymbols()) {
            try {
                const p = ns.stock.getPosition(sym);
                if (p[0] > 0) val += p[0] * ns.stock.getBidPrice(sym);
                if (p[2] > 0) val += p[2] * p[3] + p[2] * (p[3] - ns.stock.getAskPrice(sym));
            } catch { }
        }
        return val;
    }

    function longPnL(sym) {
        const p = ns.stock.getPosition(sym);
        if (p[0] <= 0) return 0;
        return (ns.stock.getBidPrice(sym) - p[1]) * p[0] - CFG.COMMISSION * 2;
    }

    function shortPnL(sym) {
        const p = ns.stock.getPosition(sym);
        if (p[2] <= 0) return 0;
        return (p[3] - ns.stock.getAskPrice(sym)) * p[2] - CFG.COMMISSION * 2;
    }

    function getSignal(sym) {
        const bid = ns.stock.getBidPrice(sym);
        const ask = ns.stock.getAskPrice(sym);
        const mid = (bid + ask) / 2;

        if (!hist[sym]) hist[sym] = [];
        hist[sym].push(mid);
        if (hist[sym].length > CFG.HISTORY) hist[sym].shift();

        if (has4S) {
            const f = ns.stock.getForecast(sym);
            const v = ns.stock.getVolatility(sym);
            return {
                forecast:  f,
                vol:       v,
                bull:      f >= CFG.BUY_4S   && v <= CFG.MAX_VOL,
                bear:      f <= CFG.SHORT_4S  && v <= CFG.MAX_VOL,
                exitLong:  f <  CFG.SELL_4S,
                exitShort: f >  CFG.COVER_4S,
                ready:     true,
            };
        }

        if (hist[sym].length < CFG.MIN_HIST) return { ready: false };
        const h     = hist[sym];
        const half  = Math.floor(h.length / 2);
        const rec   = h.slice(half).reduce((a,b)=>a+b,0) / (h.length - half);
        const old   = h.slice(0,half).reduce((a,b)=>a+b,0) / half;
        const mom   = (rec - old) / Math.max(0.01, old);
        const f     = Math.min(0.72, Math.max(0.28, 0.5 + mom * 10));
        return {
            forecast:  f,
            vol:       0.02,
            mom,
            bull:      mom >= CFG.BUY_MOM,
            bear:      mom <= CFG.SHORT_MOM,
            exitLong:  mom <= CFG.SELL_MOM,
            exitShort: mom >= CFG.COVER_MOM,
            ready:     true,
        };
    }

    ns.tprint("");
    ns.tprint("  DAYTRADER.JS  AGGRESSIVE MODE");
    ns.tprint(`  4S: ${has4S ? "YES " : "NO  (momentum mode)"}`);
    ns.tprint("  run daytrader.js sellall before augmenting!");
    ns.tprint("");

    while (true) {
        loopN++;
        const money    = ns.getPlayer().money;
        const port     = portfolio();
        const netWorth = money + port;
        const gain     = netWorth - startMoney;
        const elapsed  = Math.floor((Date.now() - startTime) / 60000);
        const gph      = elapsed > 0 ? gain / elapsed * 60 : 0;
        if (port > peakPort) peakPort = port;

        const spendable = Math.max(0, money - CFG.CASH_FLOOR);
        const budget    = spendable * CFG.BUDGET_RATIO;

        for (const sym of ns.stock.getSymbols()) {
            try {
                const sig = getSignal(sym);
                if (!sig.ready) continue;

                const pos         = ns.stock.getPosition(sym);
                const longShares  = pos[0];
                const shortShares = pos[2];
                const bid         = ns.stock.getBidPrice(sym);
                const ask         = ns.stock.getAskPrice(sym);

                // SELL LONG
                if (longShares > 0) {
                    const pnl       = longPnL(sym);
                    const takeProft = pnl > netWorth * CFG.PROFIT_TAKE;
                    const cutLoss   = pnl < -(CFG.COMMISSION * CFG.LOSS_CUT);
                    if ((sig.exitLong && pnl > -CFG.COMMISSION) || takeProft || (sig.exitLong && cutLoss)) {
                        if (ns.stock.sellStock(sym, longShares) > 0) {
                            realised += pnl; trades++; sells++;
                            ns.tprint(pnl >= 0
                                ? ` SOLD  ${sym.padEnd(5)} +$${ns.format.number(pnl)}`
                                : ` CUT   ${sym.padEnd(5)} -$${ns.format.number(Math.abs(pnl))}`);
                        }
                    }
                }

                // COVER SHORT
                if (shortShares > 0) {
                    const pnl       = shortPnL(sym);
                    const takeProfit = pnl > netWorth * CFG.PROFIT_TAKE;
                    const cutLoss   = pnl < -(CFG.COMMISSION * CFG.LOSS_CUT);
                    if ((sig.exitShort && pnl > -CFG.COMMISSION) || takeProfit || (sig.exitShort && cutLoss)) {
                        try {
                            if (ns.stock.sellShort(sym, shortShares) > 0) {
                                realised += pnl; trades++; sells++;
                                ns.tprint(` COVER ${sym.padEnd(5)} ${pnl >= 0 ? "+" : ""}$${ns.format.number(pnl)}`);
                            }
                        } catch { }
                    }
                }

                // BUY LONG
                if (longShares === 0 && shortShares === 0 && sig.bull) {
                    const avail  = Math.max(0, ns.getPlayer().money - CFG.CASH_FLOOR - CFG.COMMISSION);
                    const alloc  = avail * CFG.PER_STOCK;
                    const shares = Math.min(ns.stock.getMaxShares(sym), Math.floor(alloc / ask));
                    if (shares >= 100 && alloc > ask * 100) {
                        if (ns.stock.buyStock(sym, shares) > 0) {
                            trades++; buys++;
                            const fStr = has4S ? `F:${(sig.forecast*100).toFixed(1)}%` : `M:${((sig.mom??0)*100).toFixed(2)}%`;
                            ns.tprint(` LONG  ${sym.padEnd(5)} ${ns.format.number(shares)}sh @ $${ns.format.number(ask)} ${fStr}`);
                        }
                    }
                }

                // SHORT
                if (longShares === 0 && shortShares === 0 && sig.bear) {
                    try {
                        const avail  = Math.max(0, ns.getPlayer().money - CFG.CASH_FLOOR - CFG.COMMISSION);
                        const alloc  = avail * CFG.PER_STOCK;
                        const shares = Math.min(ns.stock.getMaxShares(sym), Math.floor(alloc / bid));
                        if (shares >= 100 && alloc > bid * 100) {
                            if (ns.stock.shortStock(sym, shares) > 0) {
                                trades++; shorts++;
                                const fStr = has4S ? `F:${(sig.forecast*100).toFixed(1)}%` : `M:${((sig.mom??0)*100).toFixed(2)}%`;
                                ns.tprint(` SHORT ${sym.padEnd(5)} ${ns.format.number(shares)}sh @ $${ns.format.number(bid)} ${fStr}`);
                            }
                        }
                    } catch { }
                }

            } catch { }
        }

        // Build positions list
        const positions = [];
        for (const sym of ns.stock.getSymbols()) {
            try {
                const p = ns.stock.getPosition(sym);
                if (p[0] > 0) positions.push({ sym, type:"LONG",  pnl: longPnL(sym),  f: has4S ? ns.stock.getForecast(sym) : getSignal(sym).forecast ?? 0.5 });
                if (p[2] > 0) positions.push({ sym, type:"SHRT",  pnl: shortPnL(sym), f: has4S ? ns.stock.getForecast(sym) : getSignal(sym).forecast ?? 0.5 });
            } catch { }
        }
        positions.sort((a,b) => b.pnl - a.pnl);

        ns.clearLog();
        ns.print(` DAYTRADER | Tick ${loopN} | ${has4S ? "4S " : "MOMENTUM"} `);
        ns.print(`  Cash:      $${ns.format.number(money)}`);
        ns.print(`  Portfolio: $${ns.format.number(port)}`);
        ns.print(`  Net worth: $${ns.format.number(netWorth)}`);
        ns.print(`  Gain:      ${gain>=0?"+":""}$${ns.format.number(gain)}`);
        ns.print(`  Gain/hr:   $${ns.format.number(gph)}`);
        ns.print(`  Realised:  $${ns.format.number(realised)} | ${trades} trades`);
        ns.print(`    B:${buys} S:${sells} Sh:${shorts}`);
        ns.print(` Positions: ${positions.length} `);
        if (positions.length === 0) {
            ns.print("  Scanning for signals...");
        } else {
            for (const p of positions.slice(0, 12)) {
                const pStr = `${p.pnl>=0?"+":""}$${ns.format.number(p.pnl)}`.padStart(14);
                ns.print(` [${p.type}] ${p.sym.padEnd(5)} ${pStr} | F:${(p.f*100).toFixed(1)}%`);
            }
            if (positions.length > 12) ns.print(`  +${positions.length-12} more`);
        }
        ns.print(` ${elapsed}m | Peak: $${ns.format.number(peakPort)} `);
        if (port > 50000000) ns.print(`   SELL BEFORE AUGMENTING: run daytrader.js sellall`);
        ns.print(` Next: ${CFG.TICK/1000}s `);

        await ns.sleep(CFG.TICK);
    }
}
