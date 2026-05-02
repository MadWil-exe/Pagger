export function statusPath(name) {
  return `/PaggerOS/status/${name.toLowerCase()}.txt`;
}

export async function writeStatus(ns, name, data) {
  const payload = {
    ...data,
    updated: Date.now(),
  };

  await ns.write(statusPath(name), JSON.stringify(payload, null, 2), "w");
}

export function readStatus(ns, name) {
  const file = statusPath(name);

  if (!ns.fileExists(file, "home")) {
    return null;
  }

  try {
    return JSON.parse(ns.read(file));
  } catch {
    return {
      state: "bad status file",
      message: "Could not parse JSON",
      updated: 0,
    };
  }
}
