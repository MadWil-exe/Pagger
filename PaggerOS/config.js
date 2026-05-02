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
      enabled: false,
      args: [],
    },
  ],

  actions: [
    {
      name: "Solve Contracts",
      script: "/PaggerOS/tools/contracts-solve.js",
      args: [],
      colour: "#facc15",
    },
    {
      name: "Open Trader UI",
      script: "/PaggerOS/ui/stocks-ui.js",
      args: ["--dry"],
      colour: "#38bdf8",
    },
    {
      name: "Gang UI",
      script: "/PaggerOS/ui/gang-ui.js",
      args: [],
      colour: "#38bdf8",
    },
    {
      name: "Hacking UI",
      script: "/PaggerOS/ui/hacking-ui.js",
      args: [],
      colour: "#38bdf8",
    },
        {
      name: "Naughty UI",
      script: "/PaggerOS/ui/naughty-ui.js",
      args: [],
      colour: "#38bdf8",
    },
  ],
};
