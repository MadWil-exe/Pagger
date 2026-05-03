export const CONFIG = {
  osName: "PaggerOS",
  tickMs: 1000,

  paths: {
    statusDir: "/PaggerOS/status",
    modulesDir: "/PaggerOS/modules",
  },

  modules: [
    {
      name: "Contracts",
      script: "/PaggerOS/modules/contracts.js",
      enabled: true,
      args: [],
    },
    {
      name: "Gang",
      script: "/PaggerOS/modules/gang.js",
      enabled: true,
      args: [],
    },
    {
      name: "Stocks",
      script: "/PaggerOS/modules/stocks.js",
      enabled: true,
      args: [],
    },
    {
      name: "Hacking",
      script: "/PaggerOS/modules/hacking.js",
      enabled: true,
      args: [],
    },
    {
      name: "Corp",
      script: "/PaggerOS/modules/corp.js",
      enabled: true,
      args: [],
    },
  ],

  actions: [
    {
      name: "Solve Contracts",
      script: "/PaggerOS/tools/cct-mgr.js",
      args: ["solve"],
      colour: "#facc15",
    },
    {
      name: "Trader",
      script: "/PaggerOS/ui/stocks-ui.js",
      args: ["--dry"],
      colour: "#38bdf8",
    },
    {
      name: "Gang",
      script: "/PaggerOS/ui/gang-ui.js",
      args: [],
      colour: "#38bdf8",
    },
    {
      name: "Hacking",
      script: "/PaggerOS/ui/hacking-ui.js",
      args: [],
      colour: "#38bdf8",
    },
    {
      name: "Naughty",
      script: "/PaggerOS/ui/naughty-ui.js",
      args: [],
      colour: "#38bdf8",
    },
        {
      name: "Auto-Start",
      script: "/PaggerOS/tools/auto-start.js",
      args: [],
      colour: "#facc15",
    },
  ],
};
