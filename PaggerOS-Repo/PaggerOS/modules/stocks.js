import { writeStatus } from "/PaggerOS/lib/status.js";

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");

  while (true) {
    try {
      const status = getStockStatus(ns);
      await writeStatus(ns, "Stocks", status);
    } catch (err) {
      await writeStatus(ns, "Stocks", {
        state: "error",
        message: String(err),
        openPositions: 0,
        grossExposure: 0,
        unrealizedPnl: 0,
      });
    }

    await ns.sleep(3000);
  }
}

function getStockStatus(ns) {
  if (!ns.stock.hasWseAccount()) {
    return {
      state: "locked",
      message: "No WSE account",
      openPositions: 0,
      grossExposure: 0,
      unrealizedPnl: 0,
      positions: [],
    };
  }

  if (!ns.stock.hasTixApiAccess()) {
    return {
      state: "locked",
      message: "No TIX API access",
      openPositions: 0,
      grossExposure: 0,
      unrealizedPnl: 0,
      positions: [],
    };
  }

  const symbols = ns.stock.getSymbols();

  let longValue = 0;
  let longCost = 0;
  let longPnl = 0;

  let shortExposure = 0;
  let shortEntryValue = 0;
  let shortPnl = 0;

  const positions = [];

  const has4S =
    typeof ns.stock.has4SDataTixApi === "function"
      ? ns.stock.has4SDataTixApi()
      : false;

  for (const sym of symbols) {
    const price = ns.stock.getPrice(sym);
    const pos = ns.stock.getPosition(sym);

    const longShares = pos[0];
    const longAvg = pos[1];
    const shortShares = pos[2];
    const shortAvg = pos[3];

    if (longShares <= 0 && shortShares <= 0) continue;

    let forecast = null;
    let volatility = null;

    if (has4S) {
      try {
        forecast = ns.stock.getForecast(sym);
        volatility = ns.stock.getVolatility(sym);
      } catch {
        forecast = null;
        volatility = null;
      }
    }

    if (longShares > 0) {
      const value = longShares * price;
      const cost = longShares * longAvg;
      const pnl = value - cost;
      const pnlPct = cost > 0 ? pnl / cost : 0;

      longValue += value;
      longCost += cost;
      longPnl += pnl;

      positions.push({
        symbol: sym,
        side: "LONG",
        shares: longShares,
        avgPrice: longAvg,
        price,
        value,
        pnl,
        pnlPct,
        forecast,
        volatility,
      });
    }

    if (shortShares > 0) {
      const exposure = shortShares * price;
      const entryValue = shortShares * shortAvg;
      const pnl = (shortAvg - price) * shortShares;
      const pnlPct = entryValue > 0 ? pnl / entryValue : 0;

      shortExposure += exposure;
      shortEntryValue += entryValue;
      shortPnl += pnl;

      positions.push({
        symbol: sym,
        side: "SHORT",
        shares: shortShares,
        avgPrice: shortAvg,
        price,
        value: exposure,
        pnl,
        pnlPct,
        forecast,
        volatility,
      });
    }
  }

  positions.sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));

  const unrealizedPnl = longPnl + shortPnl;
  const grossExposure = longValue + shortExposure;

  return {
    state: "watching",
    message: `${positions.length} open position(s)`,
    has4S,
    cash: ns.getPlayer().money,

    openPositions: positions.length,

    longValue,
    longCost,
    longPnl,

    shortExposure,
    shortEntryValue,
    shortPnl,

    grossExposure,
    unrealizedPnl,

    positions: positions.slice(0, 12),
  };
}
