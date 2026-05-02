import { readStatus } from "/PaggerOS/lib/status.js";

/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();

  while (true) {
    ns.clearLog();

    try {
      renderHackingUi(ns);
    } catch (err) {
      ns.print("PaggerOS Hacking UI render failed.");
      ns.print(String(err));

      if (err?.stack) {
        ns.print(err.stack);
      }
    }
    while (true) {
      ns.clearLog();

      try {
        processHackingActionQueue(ns);
        renderHackingUi(ns);
      } catch (err) {
        ns.print("PaggerOS Hacking UI render failed.");
        ns.print(String(err));

        if (err?.stack) {
          ns.print(err.stack);
        }
      }

      await ns.sleep(1000);
    }
  }
}

function renderHackingUi(ns) {
  const React = eval("window").React;

  if (!React || typeof ns.printRaw !== "function") {
    ns.print("React dashboard unavailable.");
    return;
  }

  const status = readStatus(ns, "Hacking");

  if (!status) {
    ns.printRaw(
      h("div", { style: styles.page },
        h("div", { style: styles.header },
          h("div", { style: styles.title }, "PaggerOS Hacking"),
          h("div", { style: styles.subtitle }, "No hacking status yet. Is /PaggerOS/modules/hacking.js running?")
        )
      )
    );
    return;
  }

  const pservs = status.pservs ?? [];
  const targets = status.targets ?? [];

  ns.printRaw(
    h("div", { style: styles.page },

      h("div", { style: styles.header },
        h("div", { style: styles.title }, "PaggerOS Hacking"),
        h("div", { style: styles.subtitle }, status.message ?? status.state ?? "watching")
      ),

      h("div", { style: styles.grid },
        statBox("Hacking", status.hacking ?? 0),
        statBox("Servers Seen", status.serversSeen ?? 0),
        statBox("Rooted", status.rooted ?? 0),
        statBox("Hackable", status.hackable ?? 0)
      ),

      h("div", { style: styles.grid },
        statBox("Home RAM", `${ns.format.ram(status.homeFreeRam ?? 0)} free`),
        statBox("PServs", `${status.purchasedCount ?? 0}/${status.purchasedLimit ?? 0}`),
        statBox("PServ RAM", `${ns.format.ram(status.freePservRam ?? 0)} free`),
        statBox("Max PServ", ns.format.ram(status.purchasedMaxRam ?? 0))
      ),
      h("div", { style: styles.sectionTitle }, "Controls"),

      h("div", { style: styles.buttonRow },
        actionButton("Buy TOR", function () {
          queueHackingAction({
            name: "Buy TOR",
            script: "/PaggerOS/tools/buy-tor.js",
            args: [],
          });
        }, "#86efac"),

        actionButton("Buy Programs", function () {
          queueHackingAction({
            name: "Buy Programs",
            script: "/PaggerOS/tools/buy-programs.js",
            args: [],
          });
        }, "#86efac"),

        actionButton("Buy Servers", function () {
          queueHackingAction({
            name: "Buy Server",
            script: "/PaggerOS/tools/buy-svr.js",
            args: [],
          });
        }, "#86efac"),

        actionButton("Upgrade Servers", function () {
          queueHackingAction({
            name: "Upgrade Servers",
            script: "/PaggerOS/tools/upgrade-server.js",
            args: [],
          });
        }, "#38bdf8"),
      ),
      collapsibleSection(
        `Pagger`,
        "pagger",
        [
          actionButton("Root All", function () {
            queueHackingAction({
              name: "Root All",
              script: "/PaggerOS/tools/rootall.js",
              args: [],
            });
          }, "#fa5215ff"),
          actionButton("Backdoor", function () {
            queueHackingAction({
              name: "Backdoor",
              script: "/PaggerOS/tools/backdoor-targets.js",
              args: [],
            });
          }, "#fa5215ff"),
          actionButton("Group Manager", function () {
            queueHackingAction({
              name: "Group Manager",
              script: "/PaggerOS/tools/group-auto.js",
              args: [],
            });
          }, "#fac815ff"),
          actionButton("Multi-Pagger", function () {
            const target = targets?.[0]?.server;

            if (!target) {
              ns.toast("No top target available for Multi-Pagger.", "warning");
              return;
            }

            queueHackingAction({
              name: `Multi-Pagger: ${target}`,
              script: "/PaggerOS/tools/pagger.js",
              args: [target],
            });
          }, "#fac815ff")
        ]
      ),
      collapsibleSection(
        `Purchased Servers (${pservs.length})`,
        "purchasedServers",
        [
          pservs.length === 0
            ? h("div", { style: styles.empty }, "No purchased servers yet.")
            : h("div", { style: styles.serverList },
              ...pservs.map(s => pservRow(ns, s))
            )
        ]
      ),

      collapsibleSection(
        `Top Targets (${targets.length})`,
        "topTargets",
        [
          targets.length === 0
            ? h("div", { style: styles.empty }, "No rooted money targets available.")
            : h("div", { style: styles.targetList },
              ...targets.map(t => targetRow(ns, t))
            )
        ]
      )
    )
  );
}
function getHackingActionQueue() {
  const win = eval("window");

  if (!win.PaggerOSHackingActionQueue) {
    win.PaggerOSHackingActionQueue = [];
  }

  return win.PaggerOSHackingActionQueue;
}

function queueHackingAction(action) {
  getHackingActionQueue().push({
    name: action.name,
    script: action.script,
    args: action.args ?? [],
    queuedAt: Date.now(),
  });
}

function processHackingActionQueue(ns) {
  const queue = getHackingActionQueue();

  while (queue.length > 0) {
    const action = queue.shift();
    const args = action.args ?? [];

    if (ns.isRunning(action.script, "home", ...args)) {
      ns.tprint(`PaggerOS Hacking: ${action.name} is already running.`);
      continue;
    }

    const pid = ns.run(action.script, 1, ...args);

    if (pid === 0) {
      ns.tprint(`PaggerOS Hacking: failed to run ${action.name} (${action.script})`);
    } else {
      ns.tprint(`PaggerOS Hacking: started ${action.name} as PID ${pid}`);
    }
  }
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
function pservRow(ns, s) {
  const usedPct = s.usedPct ?? 0;

  return h("div", { style: styles.pservRow },
    h("div", { style: styles.name }, s.name),
    h("div", {}, `RAM: ${ns.format.ram(s.maxRam)}`),
    h("div", {}, `Used: ${ns.format.ram(s.usedRam)}`),
    h("div", {}, `Free: ${ns.format.ram(s.freeRam)}`),
    h("div", { style: usedPct > 0.9 ? styles.bad : styles.good },
      `${(usedPct * 100).toFixed(1)}%`
    )
  );
}

function targetRow(ns, t) {
  return h("div", { style: styles.targetRow },
    h("div", { style: styles.name }, t.server),
    h("div", {}, `Max: $${ns.format.number(t.maxMoney, 2)}`),
    h("div", {}, `Money: ${(t.moneyPct * 100).toFixed(1)}%`),
    h("div", {
      style: t.secDelta > 10 ? styles.bad : t.secDelta > 3 ? styles.warn : styles.good,
    }, `Sec +${t.secDelta.toFixed(2)}`),
    h("div", {}, `Grow: ${t.growth}`)
  );
}

function statBox(label, value) {
  return h("div", { style: styles.card },
    h("div", { style: styles.cardLabel }, label),
    h("div", { style: styles.cardValue }, String(value))
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
function getUiState() {
  const win = eval("window");

  if (!win.PaggerOSHackingUIState) {
    win.PaggerOSHackingUIState = {
      purchasedServers: true,
      topTargets: true,
    };
  }

  return win.PaggerOSHackingUIState;
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
      h("div", {}, `${open ? "" : ""} ${title}`),
      h("div", { style: styles.collapsibleHint }, open ? "click to collapse" : "click to expand")
    ),

    open
      ? h("div", { style: styles.collapsibleBody }, ...children)
      : null
  );
}
const styles = {
  page: {
    fontFamily: "monospace",
    padding: "12px",
    color: "#e2e8f0",
    backgroundColor: "#020617",
    border: "1px solid #0ea5e9",
    borderRadius: "10px",
  },

  header: {
    marginBottom: "12px",
    paddingBottom: "8px",
    borderBottom: "1px solid #1e293b",
  },
  buttonRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginBottom: "12px",
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

  empty: {
    padding: "8px",
    border: "1px solid #334155",
    borderRadius: "8px",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    color: "#94a3b8",
    marginBottom: "10px",
  },

  serverList: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    marginBottom: "10px",
  },

  targetList: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },

  pservRow: {
    display: "grid",
    gridTemplateColumns: "140px 110px 110px 110px 70px",
    gap: "8px",
    alignItems: "center",
    padding: "6px 8px",
    border: "1px solid #334155",
    borderRadius: "7px",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    fontSize: "10px",
  },

  targetRow: {
    display: "grid",
    gridTemplateColumns: "150px 150px 100px 90px 80px",
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

  warn: {
    color: "#facc15",
  },

  bad: {
    color: "#fca5a5",
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
