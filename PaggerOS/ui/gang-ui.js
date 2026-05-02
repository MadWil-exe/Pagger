/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();

  while (true) {
    ns.clearLog();

    try {
      renderGangUi(ns);
    } catch (err) {
      ns.print("PaggerOS Gang UI render failed.");
      ns.print(String(err));

      if (err?.stack) {
        ns.print(err.stack);
      }
    }

    await ns.sleep(1000);
  }
}

function renderGangUi(ns) {
  const React = eval("window").React;

  if (!React || typeof ns.printRaw !== "function") {
    ns.print("React dashboard unavailable.");
    return;
  }

  if (!ns.gang.inGang()) {
    ns.printRaw(
      h("div", { style: styles.page },
        h("div", { style: styles.header },
          h("div", { style: styles.title }, "PaggerOS Gang"),
          h("div", { style: styles.subtitle }, "Gang not unlocked yet.")
        )
      )
    );
    return;
  }

  const info = ns.gang.getGangInformation();
  const memberNames = ns.gang.getMemberNames();

  const members = memberNames
    .map(name => {
      const m = ns.gang.getMemberInformation(name);
      const combat = Math.floor((m.str + m.def + m.dex + m.agi) / 4);

      return {
        name,
        task: m.task ?? "None",
        combat,
        hack: Math.floor(m.hack),
        str: Math.floor(m.str),
        def: Math.floor(m.def),
        dex: Math.floor(m.dex),
        agi: Math.floor(m.agi),
        cha: Math.floor(m.cha),
        moneyGain: m.moneyGain ?? 0,
        respectGain: m.respectGain ?? 0,
        wantedGain: m.wantedLevelGain ?? 0,
        ascMult: Math.max(
          m.hack_asc_mult ?? 1,
          m.str_asc_mult ?? 1,
          m.def_asc_mult ?? 1,
          m.dex_asc_mult ?? 1,
          m.agi_asc_mult ?? 1,
          m.cha_asc_mult ?? 1
        ),
      };
    })
    .sort((a, b) => b.combat - a.combat);

  const taskCounts = countBy(members, m => m.task);

  ns.printRaw(
    h("div", { style: styles.page },

      h("div", { style: styles.header },
        h("div", { style: styles.title }, "PaggerOS Gang"),
        h("div", { style: styles.subtitle }, info.faction ?? "Unknown faction")
      ),

      h("div", { style: styles.grid },
        statBox("Members", members.length),
        statBox("Respect", ns.format.number(info.respect ?? 0, 2)),
        statBox("Wanted", ns.format.number(info.wantedLevel ?? 0, 2)),
        statBox("Penalty", `${((info.wantedPenalty ?? 1) * 100).toFixed(2)}%`)
      ),

      h("div", { style: styles.grid },
        statBox("Territory", `${((info.territory ?? 0) * 100).toFixed(2)}%`),
        statBox("Power", ns.format.number(info.power ?? 0, 2)),
        statBox("Money/s", `$${ns.format.number(info.moneyGainRate ?? 0, 2)}`),
        statBox("Respect/s", ns.format.number(info.respectGainRate ?? 0, 2))
      ),

      h("div", { style: styles.sectionTitle }, "Task Split"),

      h("div", { style: styles.taskRow },
        ...Object.entries(taskCounts).map(([task, count]) =>
          h("div", { style: styles.taskPill, key: task },
            `${task}: ${count}`
          )
        )
      ),

      h("div", { style: styles.sectionTitle }, "Members"),

      h("div", { style: styles.memberList },
        ...members.map(member => memberRow(ns, member))
      )
    )
  );
}

function memberRow(ns, m) {
  return h("div", { style: styles.memberRow },

    h("div", {},
      h("div", { style: styles.memberName }, m.name),
      h("div", { style: styles.memberTask }, m.task)
    ),

    h("div", { style: styles.memberStatBlock },
      h("div", {}, `Combat: ${ns.format.number(m.combat, 0)}`),
      h("div", {}, `H:${m.hack} C:${m.cha}`)
    ),

    h("div", { style: styles.memberStatBlock },
      h("div", {}, `STR:${m.str} DEF:${m.def}`),
      h("div", {}, `DEX:${m.dex} AGI:${m.agi}`)
    ),

    h("div", { style: styles.memberGainBlock },
      h("div", { style: { color: "#86efac" } }, `$${formatGain(m.moneyGain)}/s`),
      h("div", {}, `Rsp ${formatGain(m.respectGain)}/s`)
    ),

    h("div", {
      style: {
        ...styles.memberGainBlock,
        color: m.wantedGain > 0 ? "#fca5a5" : "#86efac",
      },
    },
      h("div", {}, `Wnt ${formatGain(m.wantedGain)}/s`),
      h("div", { style: { color: "#facc15" } }, `Asc ${m.ascMult.toFixed(2)}x`)
    )
  );
}

function statBox(label, value) {
  return h("div", { style: styles.card },
    h("div", { style: styles.cardLabel }, label),
    h("div", { style: styles.cardValue }, String(value))
  );
}

function countBy(items, selector) {
  const out = {};

  for (const item of items) {
    const key = selector(item);
    out[key] = (out[key] ?? 0) + 1;
  }

  return out;
}

function formatGain(value) {
  if (!Number.isFinite(value)) return "0.00";
  return value.toFixed(2);
}

function h(type, props, ...children) {
  const React = eval("window").React;

  return React.createElement(
    type,
    props ?? {},
    ...children.filter(child => child !== null && child !== undefined)
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

  taskRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginBottom: "10px",
  },

  taskPill: {
    padding: "4px 8px",
    border: "1px solid #334155",
    borderRadius: "999px",
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    color: "#cbd5e1",
    fontSize: "10px",
  },

  memberList: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },

  memberRow: {
    display: "grid",
    gridTemplateColumns: "130px 110px 135px 120px 110px",
    gap: "8px",
    alignItems: "center",
    padding: "6px 8px",
    border: "1px solid #334155",
    borderRadius: "7px",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    fontSize: "10px",
  },

  memberName: {
    color: "#86efac",
    fontWeight: "bold",
    fontSize: "12px",
  },

  memberTask: {
    color: "#94a3b8",
    fontSize: "10px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  memberStatBlock: {
    color: "#cbd5e1",
    lineHeight: "1.4",
  },

  memberGainBlock: {
    color: "#cbd5e1",
    lineHeight: "1.4",
    textAlign: "right",
  },
};
