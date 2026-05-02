import { CONFIG } from "/PaggerOS/config.js";
import { readStatus } from "/PaggerOS/lib/status.js";

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();

  ns.tprint("PaggerOS kernel started.");

  while (true) {
    try {
      processActionQueue(ns);

      for (const mod of CONFIG.modules) {
        ensureRunning(ns, mod);
      }

      renderDashboard(ns);
    } catch (err) {
      ns.clearLog();
      ns.print("PaggerOS kernel error:");
      ns.print(String(err));

      if (err?.stack) {
        ns.print(err.stack);
      }

      ns.tprint("PaggerOS kernel error:");
      ns.tprint(String(err));
    }

    await ns.sleep(CONFIG.tickMs ?? 1000);
  }
}

function renderDashboard(ns) {
  const win = eval("window");
  const React = win.React;

  ns.clearLog();

  if (!React || typeof ns.printRaw !== "function") {
    ns.print("React dashboard unavailable.");
    ns.print(`React exists: ${!!React}`);
    ns.print(`printRaw exists: ${typeof ns.printRaw === "function"}`);
    return;
  }

  try {
    const player = ns.getPlayer();
    const home = ns.getServer("home");

    const hacking =
      player.skills?.hacking ??
      player.hacking ??
      "unknown";

    const money = player.money ?? 0;
    const freeRam = Math.max(0, home.maxRam - home.ramUsed);

    const moduleRows = CONFIG.modules.map((mod, index) => {
      const running = ns.isRunning(mod.script, "home", ...mod.args);
      const status = readStatus(ns, mod.name);

      const state = status?.state ?? "no status";

      let message = status?.message ?? "";

      if (mod.name === "Contracts" && status) {
        const total = status.contractsFound ?? 0;
        const supported = status.solvedSupported ?? 0;
        const missing = status.missingSolvers ?? 0;

        message = `${total} found / ${supported} supported / ${missing} missing`;
      }

      const contractDetails =
        mod.name === "Contracts" && Array.isArray(status?.contracts)
          ? status.contracts.slice(0, 6).map((contract, cIndex) =>
            h("div", {
              key: `${contract.server}-${contract.file}-${cIndex}`,
              style: {
                display: "grid",
                gridTemplateColumns: "160px 1fr 80px",
                gap: "8px",
                padding: "4px 8px",
                marginTop: "4px",
                borderTop: cIndex === 0 ? "1px solid #1e293b" : "none",
                fontSize: "10px",
                color: "#cbd5e1",
              },
            },
              h("div", {
                style: {
                  color: "#7dd3fc",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                },
              }, contract.server),

              h("div", {
                style: {
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                },
                title: `${contract.file} - ${contract.type}`,
              }, `${contract.file} | ${contract.type}`),

              h("div", {
                style: {
                  textAlign: "right",
                  color: contract.hasSolver ? "#86efac" : "#fca5a5",
                },
              }, contract.hasSolver ? "solver" : "missing")
            )
          )
          : [];

      return h("div", {
        key: `${mod.name}-${index}`,
        style: {
          padding: "8px",
          marginBottom: "6px",
          border: "1px solid #334155",
          borderRadius: "8px",
          backgroundColor: "rgba(15, 23, 42, 0.8)",
        },
      },
        h("div", {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          },
        },
          h("div", {},
            h("div", {
              style: {
                fontWeight: "bold",
                color: running ? "#86efac" : "#cbd5e1",
              },
            }, `${running ? "" : ""} ${mod.name}`),

            h("div", {
              style: {
                fontSize: "10px",
                color: "#64748b",
              },
            }, mod.script)
          ),

          h("div", {
            style: {
              textAlign: "right",
              fontSize: "11px",
              color: "#cbd5e1",
            },
          },
            h("div", {}, `${mod.enabled ? "enabled" : "manual"} / ${running ? "running" : "stopped"}`),
            h("div", { style: { color: "#94a3b8" } }, state),
            h("div", { style: { color: "#64748b" } }, message)
          )
        ),

        ...contractDetails
      );
    });
    const stockStatus = readStatus(ns, "Stocks");
    const gangStatus = readStatus(ns, "Gang");
    const hackingStatus = readStatus(ns, "Hacking");
    const dashboard = h("div", {
      style: {
        fontFamily: "monospace",
        padding: "12px",
        color: "#e2e8f0",
        backgroundColor: "#020617",
        border: "1px solid #0ea5e9",
        borderRadius: "10px",
      },
    },
      h("div", {
        style: {
          marginBottom: "12px",
          paddingBottom: "8px",
          borderBottom: "1px solid #1e293b",
        },
      },
        h("div", {
          style: {
            fontSize: "26px",
            fontWeight: "bold",
            color: "#38bdf8",
            letterSpacing: "2px",
          },
        }, "PaggerOS"),

        h("div", {
          style: {
            fontSize: "12px",
            color: "#7dd3fc",
          },
        }, "game is getting paggered")
      ),
      h("div", {
        style: {
          fontSize: "14px",
          fontWeight: "bold",
          color: "#38bdf8",
          marginBottom: "8px",
        },
      }, "Actions"),

      h("div", {
        style: {
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          marginBottom: "12px",
        },
      },
        ...(CONFIG.actions ?? []).map((action, index) =>
          actionButton(
            action.name,
            () => queueAction(action),
            action.colour ?? "#38bdf8"
          )
        )
      ),
      h("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(100px, 1fr))",
          gap: "8px",
          marginBottom: "12px",
        },
      },
        statBox("Money", `$${ns.format.number(money, 2)}`),
        statBox("Hacking", hacking),
        statBox("Karma", ns.heart.break().toFixed(2)),
        statBox("Home RAM", `${ns.format.ram(freeRam)} free`)
      ),
      h("div", {
        style: {
          fontSize: "14px",
          fontWeight: "bold",
          color: "#38bdf8",
          marginBottom: "8px",
        },
      }, "Hacking"),

      h("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(100px, 1fr))",
          gap: "8px",
          marginBottom: "12px",
        },
      },
        statBox("Rooted", `${hackingStatus?.rooted ?? 0}/${hackingStatus?.serversSeen ?? 0}`),
        statBox("Hackable", hackingStatus?.hackable ?? 0),
        statBox("PServs", `${hackingStatus?.purchasedCount ?? 0}/${hackingStatus?.purchasedLimit ?? 0}`),
        statBox("PServ RAM", `${ns.format.ram(hackingStatus?.freePservRam ?? 0)} free`)
      ),
      // GANG
      h("div", {
        style: {
          fontSize: "14px",
          fontWeight: "bold",
          color: "#38bdf8",
          marginBottom: "8px",
        },
      }, "Gang"),

      h("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(100px, 1fr))",
          gap: "8px",
          marginBottom: "10px",
        },
      },
        statBox("State", gangStatus?.state ?? "unknown"),
        statBox("Members", gangStatus?.members ?? 0),
        statBox("Respect", ns.format.number(gangStatus?.respect ?? 0, 2)),
        statBox("Wanted", ns.format.number(gangStatus?.wanted ?? 0, 2))
      ),
      // STOCKS
      h("div", {
        style: {
          fontSize: "14px",
          fontWeight: "bold",
          color: "#38bdf8",
          marginBottom: "8px",
        },
      }, "Stocks"),

      h("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(100px, 1fr))",
          gap: "8px",
          marginBottom: "10px",
        },
      },
        statBox("Open Positions", stockStatus?.openPositions ?? 0),
        statBox("Exposure", `$${ns.format.number(stockStatus?.grossExposure ?? 0, 2)}`),
        statBox("Unrealised P/L", `$${ns.format.number(stockStatus?.unrealizedPnl ?? 0, 2)}`),
        statBox("4S Data", stockStatus?.has4S ? "yes" : "no")
      ),

      h("div", {
        style: {
          marginBottom: "12px",
        },
      },
        ...((stockStatus?.positions ?? []).slice(0, 6).map((p, index) =>
          h("div", {
            key: `${p.symbol}-${p.side}-${index}`,
            style: {
              display: "grid",
              gridTemplateColumns: "70px 70px 1fr 1fr 1fr",
              gap: "8px",
              padding: "4px 8px",
              marginBottom: "4px",
              border: "1px solid #1e293b",
              borderRadius: "6px",
              backgroundColor: "rgba(15, 23, 42, 0.7)",
              fontSize: "10px",
            },
          },
            h("div", { style: { color: "#7dd3fc", fontWeight: "bold" } }, p.symbol),
            h("div", { style: { color: p.side === "LONG" ? "#86efac" : "#fca5a5" } }, p.side),
            h("div", {}, `Value: $${ns.format.number(p.value, 2)}`),
            h("div", {
              style: {
                color: p.pnl >= 0 ? "#86efac" : "#fca5a5",
              },
            }, `P/L: $${ns.format.number(p.pnl, 2)}`),
            h("div", {}, `${(p.pnlPct * 100).toFixed(2)}%`)
          )
        ))
      ),
      collapsibleSection(
        `Modules`,
        "modules",
        moduleRows
      )
    );
    ns.printRaw(dashboard);
  } catch (err) {
    ns.print("PaggerOS React render failed.");
    ns.print(String(err));

    if (err?.stack) {
      ns.print(err.stack);
    }

    ns.tprint("PaggerOS React render failed:");
    ns.tprint(String(err));
  }
}
function collapsibleSection(title, key, children = []) {
  const state = getUiState();
  const open = state[key] !== false;

  return h("div", { style: styles.section },

    h("div", {
      style: styles.collapsibleHeader,
      onClick: () => toggleSection(key),
    },
      h("span", {}, `${open ? "" : ""} ${title}`),
      h("span", {
        style: {
          fontSize: "10px",
          color: "#64748b",
          marginLeft: "auto",
        },
      }, open ? "click to collapse" : "click to expand")
    ),

    open
      ? h("div", {
        style: {
          marginTop: "8px",
        },
      }, ...children)
      : null
  );
}

const UI_STATE_KEY = "PaggerOS.dashboard.uiState";

function getUiState() {
  try {
    return JSON.parse(localStorage.getItem(UI_STATE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function toggleSection(key) {
  const state = getUiState();

  state[key] = state[key] === false ? true : false;

  localStorage.setItem(UI_STATE_KEY, JSON.stringify(state));
}

function ensureRunning(ns, mod) {
  if (!mod.enabled) return;

  const alreadyRunning = ns.isRunning(mod.script, "home", ...mod.args);
  if (alreadyRunning) return;

  ns.run(mod.script, 1, ...mod.args);
}

const styles = {
  page: {
    fontFamily: "monospace",
    padding: "12px",
    color: "#d7f7ff",
    background: "linear-gradient(135deg, #020617, #07111f)",
    minHeight: "100%",
    boxSizing: "border-box",
  },

  header: {
    padding: "14px",
    marginBottom: "12px",
    border: "1px solid #00b7ff",
    borderRadius: "10px",
    background: "rgba(0, 183, 255, 0.08)",
    boxShadow: "0 0 16px rgba(0, 183, 255, 0.25)",
  },

  title: {
    fontSize: "28px",
    fontWeight: "bold",
    color: "#00e5ff",
    letterSpacing: "2px",
  },

  subtitle: {
    fontSize: "12px",
    color: "#8bdcff",
    marginTop: "4px",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(120px, 1fr))",
    gap: "10px",
    marginBottom: "12px",
  },

  card: {
    border: "1px solid #1e3a5f",
    borderRadius: "10px",
    padding: "10px",
    background: "rgba(15, 23, 42, 0.85)",
  },

  cardLabel: {
    fontSize: "11px",
    color: "#7dd3fc",
    marginBottom: "6px",
  },

  cardValue: {
    fontSize: "18px",
    color: "#ffffff",
    fontWeight: "bold",
  },

  section: {
    border: "1px solid #1e3a5f",
    borderRadius: "10px",
    padding: "10px",
    marginBottom: "12px",
    background: "rgba(15, 23, 42, 0.65)",
  },

  sectionTitle: {
    fontSize: "15px",
    color: "#00e5ff",
    marginBottom: "10px",
    fontWeight: "bold",
  },

  progressWrap: {
    marginTop: "6px",
  },

  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
    marginBottom: "5px",
    color: "#bae6fd",
  },

  progressOuter: {
    height: "12px",
    borderRadius: "999px",
    overflow: "hidden",
    background: "#111827",
    border: "1px solid #334155",
  },

  progressInner: {
    height: "100%",
    background: "linear-gradient(90deg, #0284c7, #22d3ee)",
    transition: "width 0.3s ease",
  },

  moduleList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  moduleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    border: "1px solid #243449",
    borderRadius: "8px",
    padding: "8px",
    background: "rgba(2, 6, 23, 0.65)",
  },

  moduleLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: "250px",
  },

  statusDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    flexShrink: 0,
  },

  moduleName: {
    fontSize: "14px",
    color: "#fff",
    fontWeight: "bold",
  },

  modulePath: {
    fontSize: "10px",
    color: "#64748b",
  },

  moduleRight: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: "6px",
    textAlign: "right",
  },

  badge: {
    border: "1px solid",
    borderRadius: "999px",
    padding: "2px 8px",
    fontSize: "11px",
  },

  moduleState: {
    color: "#e2e8f0",
    fontSize: "12px",
  },

  moduleMessage: {
    color: "#94a3b8",
    fontSize: "11px",
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

function h(type, props, ...children) {
  const React = eval("window").React;

  return React.createElement(
    type,
    props ?? {},
    ...children.filter(child => child !== null && child !== undefined)
  );
}

function statBox(label, value) {
  return h("div", {
    style: {
      padding: "8px",
      border: "1px solid #334155",
      borderRadius: "8px",
      backgroundColor: "rgba(15, 23, 42, 0.9)",
    },
  },
    h("div", {
      style: {
        fontSize: "10px",
        color: "#7dd3fc",
        marginBottom: "4px",
      },
    }, label),

    h("div", {
      style: {
        fontSize: "16px",
        fontWeight: "bold",
        color: "#ffffff",
      },
    }, String(value))
  );
}

function actionButton(label, onClick, colour = "#38bdf8") {
  return h("button", {
    type: "button",
    onClick,
    style: {
      cursor: "pointer",
      padding: "4px 10px",
      border: `1px solid ${colour}`,
      borderRadius: "6px",
      backgroundColor: "rgba(15, 23, 42, 0.95)",
      color: colour,
      fontFamily: "monospace",
      fontSize: "11px",
      fontWeight: "bold",
    },
  }, label);
}

function runAction(ns, action) {
  const args = action.args ?? [];

  if (ns.isRunning(action.script, "home", ...args)) {
    ns.tprint(`PaggerOS: ${action.name} is already running.`);
    return;
  }

  const pid = ns.run(action.script, 1, ...args);

  if (pid === 0) {
    ns.tprint(`PaggerOS: failed to run ${action.name} (${action.script})`);
  } else {
    ns.tprint(`PaggerOS: started ${action.name} as PID ${pid}`);
  }
}

function getActionQueue() {
  const win = eval("window");

  if (!win.PaggerOSActionQueue) {
    win.PaggerOSActionQueue = [];
  }

  return win.PaggerOSActionQueue;
}

function queueAction(action) {
  const queue = getActionQueue();

  queue.push({
    name: action.name,
    script: action.script,
    args: action.args ?? [],
    queuedAt: Date.now(),
  });
}

function processActionQueue(ns) {
  const queue = getActionQueue();

  while (queue.length > 0) {
    const action = queue.shift();

    const args = action.args ?? [];

    if (ns.isRunning(action.script, "home", ...args)) {
      ns.tprint(`PaggerOS: ${action.name} is already running.`);
      continue;
    }

    const pid = ns.run(action.script, 1, ...args);

    if (pid === 0) {
      ns.tprint(`PaggerOS: failed to run ${action.name} (${action.script})`);
    } else {
      ns.tprint(`PaggerOS: started ${action.name} as PID ${pid}`);
    }
  }
}
