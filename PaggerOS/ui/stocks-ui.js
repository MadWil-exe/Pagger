/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();

  if (ns.ui.setTailTitle) {
    ns.ui.setTailTitle("Stocks");
  }

  while (true) {
    ns.clearLog();

    try {
      processStocksActionQueue(ns);
      renderStocksUi(ns);
    } catch (err) {
      ns.print("PaggerOS Stocks UI render failed.");
      ns.print(String(err));

      if (err?.stack) {
        ns.print(err.stack);
      }
    }

    await ns.sleep(1000);
  }
}

function renderStocksUi(ns) {
  const React = eval("window").React;

  if (!React || typeof ns.printRaw !== "function") {
    ns.print("React dashboard unavailable.");
    return;
  }

  const access = getAccess(ns);
  const positions = getPositions(ns);
  const totals = getTotals(positions);
  const signals = getSignals(ns, access);

  const traderScript = "/PaggerOS/tools/day-trader.js";
  const traderRunning = ns.isRunning(traderScript, "home");

  ns.printRaw(
    h("div", { style: styles.page },

      h("div", { style: styles.header },
        h("div", { style: styles.title }, "PaggerOS Stocks"),
        h("div", { style: styles.subtitle },
          traderRunning ? "Trader running" : "Trader stopped"
        )
      ),

      h("div", { style: styles.pillRow },
        accessPill("WSE", access.wse),
        accessPill("TIX", access.tix),
        accessPill("4S Data", access.data4s),
        accessPill("4S TIX", access.tix4s)
      ),

      h("div", { style: styles.grid },
        statBox("Cash", fmtMoney(ns, ns.getServerMoneyAvailable("home"))),
        statBox("Long Value", fmtMoney(ns, totals.longValue)),
        statBox("Long P/L", fmtMoney(ns, totals.longProfit), totals.longProfit >= 0 ? styles.good : styles.bad),
        statBox("Short P/L", fmtMoney(ns, totals.shortProfit), totals.shortProfit >= 0 ? styles.good : styles.bad)
      ),

      h("div", { style: styles.sectionTitle }, "Controls"),

      h("div", { style: styles.buttonRow },
        actionButton("Buy WSE", function () {
          queueStocksAction({ type: "buy-wse", name: "Buy WSE" });
        }, "#38bdf8"),

        actionButton("Buy TIX", function () {
          queueStocksAction({ type: "buy-tix", name: "Buy TIX" });
        }, "#60a5fa"),

        actionButton("Buy 4S Data", function () {
          queueStocksAction({ type: "buy-4s", name: "Buy 4S Data" });
        }, "#c084fc"),

        actionButton("Buy 4S TIX", function () {
          queueStocksAction({ type: "buy-4s-tix", name: "Buy 4S TIX" });
        }, "#e879f9"),

        actionButton("Start Trader", function () {
          queueStocksAction({
            type: "run-script",
            name: "Start Trader",
            script: traderScript,
            args: [],
          });
        }, "#86efac"),

        actionButton("Stop Trader", function () {
          queueStocksAction({
            type: "kill-script",
            name: "Stop Trader",
            script: traderScript,
            args: [],
          });
        }, "#facc15"),

        actionButton("Sell Longs", function () {
          queueStocksAction({ type: "liquidate-longs", name: "Sell Longs" });
        }, "#fca5a5"),

        actionButton("Cover Shorts", function () {
          queueStocksAction({ type: "liquidate-shorts", name: "Cover Shorts" });
        }, "#fca5a5"),

        actionButton("Liquidate All", function () {
          queueStocksAction({ type: "liquidate-all", name: "Liquidate All" });
        }, "#fb7185")
      ),

      collapsibleSection(
        `Open Positions (${positions.length})`,
        "positions",
        [
          positions.length === 0
            ? h("div", { style: styles.empty }, "No open positions.")
            : h("div", { style: styles.positionList },
              ...positions.map(p => positionRow(ns, p))
            )
        ]
      ),

      collapsibleSection(
        `4S Signals (${signals.length})`,
        "signals",
        [
          !access.tix4s
            ? h("div", { style: styles.empty }, "4S TIX API is not unlocked yet.")
            : h("div", { style: styles.signalList },
              ...signals.map(s => signalRow(ns, s))
            )
        ]
      )
    )
  );
}

function getAccess(ns) {
  return {
    wse: firstBool(
      () => ns.stock.hasWSEAccount?.(),
      () => ns.stock.hasWseAccount?.()
    ),

    tix: firstBool(
      () => ns.stock.hasTIXAPIAccess?.(),
      () => ns.stock.hasTixApiAccess?.(),
      () => ns.stock.hasTIXApiAccess?.()
    ),

    data4s: firstBool(
      () => ns.stock.has4SData?.()
    ),

    tix4s: firstBool(
      () => ns.stock.has4SDataTIXAPI?.(),
      () => ns.stock.has4SDataTixApi?.(),
      () => ns.stock.has4SDataTixApiAccess?.()
    ),
  };
}

function firstBool(...checks) {
  for (const check of checks) {
    try {
      const result = check();

      if (typeof result === "boolean") {
        return result;
      }
    } catch {
      // Try the next possible API spelling.
    }
  }

  return false;
}

function getPositions(ns) {
  const symbols = safeArray(() => ns.stock.getSymbols());

  return symbols.map(sym => {
    const price = safeNumber(() => ns.stock.getPrice(sym));
    const pos = safeArray(() => ns.stock.getPosition(sym));

    const longShares = pos[0] ?? 0;
    const longAvg = pos[1] ?? 0;
    const shortShares = pos[2] ?? 0;
    const shortAvg = pos[3] ?? 0;

    const longValue = longShares * price;
    const shortValue = shortShares * price;

    const longProfit = longShares > 0
      ? (price - longAvg) * longShares
      : 0;

    const shortProfit = shortShares > 0
      ? (shortAvg - price) * shortShares
      : 0;

    return {
      sym,
      price,
      longShares,
      longAvg,
      longValue,
      longProfit,
      shortShares,
      shortAvg,
      shortValue,
      shortProfit,
    };
  }).filter(p => p.longShares > 0 || p.shortShares > 0);
}

function getTotals(positions) {
  return positions.reduce((acc, p) => {
    acc.longValue += p.longValue;
    acc.longProfit += p.longProfit;
    acc.shortValue += p.shortValue;
    acc.shortProfit += p.shortProfit;
    return acc;
  }, {
    longValue: 0,
    longProfit: 0,
    shortValue: 0,
    shortProfit: 0,
  });
}

function getSignals(ns, access) {
  if (!access.tix4s) return [];

  const symbols = safeArray(() => ns.stock.getSymbols());

  return symbols.map(sym => {
    const price = safeNumber(() => ns.stock.getPrice(sym));
    const forecast = safeNumber(() => ns.stock.getForecast(sym));
    const volatility = safeNumber(() => ns.stock.getVolatility(sym));
    const edge = Math.abs(forecast - 0.5);

    const bias =
      forecast > 0.55 ? "LONG" :
        forecast < 0.45 ? "SHORT" :
          "NEUTRAL";

    return {
      sym,
      price,
      forecast,
      volatility,
      edge,
      bias,
    };
  })
    .sort((a, b) => b.edge - a.edge)
    .slice(0, 20);
}

function positionRow(ns, p) {
  return h("div", { style: styles.positionRow },
    h("div", { style: styles.name }, p.sym),
    h("div", {}, fmtMoney(ns, p.price)),
    h("div", {}, p.longShares > 0 ? `L: ${ns.format.number(p.longShares, 0)}` : "L: -"),
    h("div", { style: p.longProfit >= 0 ? styles.good : styles.bad },
      p.longShares > 0 ? fmtMoney(ns, p.longProfit) : "-"
    ),
    h("div", {}, p.shortShares > 0 ? `S: ${ns.format.number(p.shortShares, 0)}` : "S: -"),
    h("div", { style: p.shortProfit >= 0 ? styles.good : styles.bad },
      p.shortShares > 0 ? fmtMoney(ns, p.shortProfit) : "-"
    )
  );
}

function signalRow(ns, s) {
  const biasStyle =
    s.bias === "LONG" ? styles.good :
      s.bias === "SHORT" ? styles.bad :
        styles.muted;

  return h("div", { style: styles.signalRow },
    h("div", { style: styles.name }, s.sym),
    h("div", {}, fmtMoney(ns, s.price)),
    h("div", { style: biasStyle }, s.bias),
    h("div", {}, `${(s.forecast * 100).toFixed(2)}%`),
    h("div", {}, `${(s.volatility * 100).toFixed(2)}%`),
    h("div", {}, `${(s.edge * 100).toFixed(2)}%`)
  );
}

function accessPill(label, enabled) {
  return h("div", {
    style: enabled ? styles.pillGood : styles.pillBad,
  }, `${label}: ${enabled ? "YES" : "NO"}`);
}

function statBox(label, value, valueStyle) {
  return h("div", { style: styles.card },
    h("div", { style: styles.cardLabel }, label),
    h("div", { style: { ...styles.cardValue, ...(valueStyle ?? {}) } }, String(value))
  );
}

function getStocksActionQueue() {
  const win = eval("window");

  if (!win.PaggerOSStocksActionQueue) {
    win.PaggerOSStocksActionQueue = [];
  }

  return win.PaggerOSStocksActionQueue;
}

function queueStocksAction(action) {
  getStocksActionQueue().push({
    ...action,
    queuedAt: Date.now(),
  });
}

function processStocksActionQueue(ns) {
  const queue = getStocksActionQueue();

  while (queue.length > 0) {
    const action = queue.shift();

    try {
      switch (action.type) {
        case "buy-wse":
          ns.stock.purchaseWseAccount();
          ns.tprint("PaggerOS Stocks: bought WSE account.");
          break;

        case "buy-tix":
          ns.stock.purchaseTixApi();
          ns.tprint("PaggerOS Stocks: bought TIX API.");
          break;

        case "buy-4s":
          ns.stock.purchase4SMarketData();
          ns.tprint("PaggerOS Stocks: bought 4S Market Data.");
          break;

        case "buy-4s-tix":
          ns.stock.purchase4SMarketDataTixApi();
          ns.tprint("PaggerOS Stocks: bought 4S TIX API.");
          break;

        case "run-script":
          if (ns.isRunning(action.script, "home", ...(action.args ?? []))) {
            ns.tprint(`PaggerOS Stocks: ${action.name} is already running.`);
          } else {
            const pid = ns.run(action.script, 1, ...(action.args ?? []));
            ns.tprint(pid === 0
              ? `PaggerOS Stocks: failed to start ${action.name}.`
              : `PaggerOS Stocks: started ${action.name} as PID ${pid}.`
            );
          }
          break;

        case "kill-script":
          ns.scriptKill(action.script, "home");
          ns.tprint(`PaggerOS Stocks: stopped ${action.name}.`);
          break;

        case "liquidate-longs":
          liquidate(ns, "long");
          break;

        case "liquidate-shorts":
          liquidate(ns, "short");
          break;

        case "liquidate-all":
          liquidate(ns, "all");
          break;
      }
    } catch (err) {
      ns.tprint(`PaggerOS Stocks: action failed - ${action.name}`);
      ns.tprint(String(err));
    }
  }
}

function liquidate(ns, mode) {
  const symbols = safeArray(() => ns.stock.getSymbols());

  for (const sym of symbols) {
    const pos = safeArray(() => ns.stock.getPosition(sym));

    const longShares = pos[0] ?? 0;
    const shortShares = pos[2] ?? 0;

    if ((mode === "long" || mode === "all") && longShares > 0) {
      ns.stock.sellStock(sym, longShares);
    }

    if ((mode === "short" || mode === "all") && shortShares > 0) {
      ns.stock.sellShort(sym, shortShares);
    }
  }

  ns.tprint(`PaggerOS Stocks: liquidated ${mode}.`);
}

function actionButton(label, onClick, colour) {
  return h("button", {
    type: "button",
    onClick,
    style: {
      cursor: "pointer",
      padding: "4px 10px",
      border: `1px solid ${colour ?? "#38bdf8"}`,
      borderRadius: "6px",
      backgroundColor: "rgba(15, 23, 42, 0.95)",
      color: colour ?? "#38bdf8",
      fontFamily: "monospace",
      fontSize: "11px",
      fontWeight: "bold",
    },
  }, label);
}

function getUiState() {
  const win = eval("window");

  if (!win.PaggerOSStocksUIState) {
    win.PaggerOSStocksUIState = {
      positions: true,
      signals: true,
    };
  }

  return win.PaggerOSStocksUIState;
}

function toggleSection(key) {
  const state = getUiState();
  state[key] = !state[key];
}

function collapsibleSection(title, key, children) {
  const state = getUiState();
  const open = state[key] !== false;

  return h("div", { style: styles.section },

    h("div", {
      style: styles.collapsibleHeader,
      onClick: function () {
        toggleSection(key);
      },
    },
      h("div", {}, `${open ? "â–¼" : "â–¶"} ${title}`),
      h("div", { style: styles.collapsibleHint }, open ? "click to collapse" : "click to expand")
    ),

    open
      ? h("div", { style: styles.collapsibleBody }, ...children)
      : null
  );
}

function h(type, props, ...children) {
  const React = eval("window").React;

  return React.createElement(
    type,
    props ?? {},
    ...children.filter(child => child !== null && child !== undefined)
  );
}

function safeBool(fn) {
  try {
    return !!fn();
  } catch {
    return false;
  }
}

function safeNumber(fn) {
  try {
    const n = fn();
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function safeArray(fn) {
  try {
    const arr = fn();
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function fmtMoney(ns, value) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return "$0.00";
  }

  if (ns.format?.number) {
    return "$" + ns.format.number(n, 2);
  }

  if (typeof ns.formatNumber === "function") {
    return "$" + ns.formatNumber(n, 2);
  }

  if (typeof ns.nFormat === "function") {
    return ns.nFormat(n, "$0.00a");
  }

  return "$" + n.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

const styles = {
  page: {
    fontFamily: "monospace",
    padding: "12px",
    color: "#e2e8f0",
    backgroundColor: "#020617",
    border: "1px solid #38bdf8",
    borderRadius: "10px",
  },

  header: {
    marginBottom: "12px",
    paddingBottom: "8px",
    borderBottom: "1px solid #1e293b",
  },

  title: {
    fontSize: "24px",
    fontWeight: "bold",
    color: "#38bdf8",
    letterSpacing: "1px",
  },

  subtitle: {
    fontSize: "12px",
    color: "#7dd3fc",
  },

  pillRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginBottom: "10px",
  },

  pillGood: {
    padding: "4px 8px",
    border: "1px solid #38bdf8",
    borderRadius: "999px",
    color: "#7dd3fc",
    fontSize: "11px",
    backgroundColor: "rgba(15, 23, 42, 0.9)",
  },

  pillBad: {
    padding: "4px 8px",
    border: "1px solid #ef4444",
    borderRadius: "999px",
    color: "#fca5a5",
    fontSize: "11px",
    backgroundColor: "rgba(15, 23, 42, 0.9)",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(110px, 1fr))",
    gap: "8px",
    marginBottom: "10px",
  },

  card: {
    padding: "8px",
    border: "1px solid #334155",
    borderRadius: "8px",
    backgroundColor: "rgba(15, 23, 42, 0.9)",
  },

  cardLabel: {
    fontSize: "10px",
    color: "#7dd3fc",
    marginBottom: "4px",
  },

  cardValue: {
    fontSize: "16px",
    fontWeight: "bold",
    color: "#ffffff",
  },

  sectionTitle: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "#38bdf8",
    marginTop: "12px",
    marginBottom: "8px",
  },

  buttonRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginBottom: "12px",
  },

  empty: {
    padding: "8px",
    border: "1px solid #334155",
    borderRadius: "8px",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    color: "#94a3b8",
    marginBottom: "10px",
  },

  positionList: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    marginBottom: "10px",
  },

  signalList: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    marginBottom: "10px",
  },

  positionRow: {
    display: "grid",
    gridTemplateColumns: "80px 110px 100px 120px 100px 120px",
    gap: "8px",
    alignItems: "center",
    padding: "6px 8px",
    border: "1px solid #334155",
    borderRadius: "7px",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    fontSize: "10px",
  },

  signalRow: {
    display: "grid",
    gridTemplateColumns: "80px 110px 80px 90px 90px 90px",
    gap: "8px",
    alignItems: "center",
    padding: "6px 8px",
    border: "1px solid #334155",
    borderRadius: "7px",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    fontSize: "10px",
  },

  name: {
    color: "#86efac",
    fontWeight: "bold",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  good: {
    color: "#86efac",
  },

  bad: {
    color: "#fca5a5",
  },

  warn: {
    color: "#facc15",
  },

  muted: {
    color: "#94a3b8",
  },

  section: {
    marginBottom: "12px",
  },

  collapsibleHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
    userSelect: "none",
    padding: "6px 8px",
    border: "1px solid #334155",
    borderRadius: "7px",
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    color: "#38bdf8",
    fontSize: "13px",
    fontWeight: "bold",
    marginTop: "12px",
    marginBottom: "6px",
  },

  collapsibleHint: {
    color: "#64748b",
    fontSize: "10px",
    fontWeight: "normal",
  },

  collapsibleBody: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
};
