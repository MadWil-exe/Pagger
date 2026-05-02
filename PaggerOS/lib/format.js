export function money(ns, value) {
  return "$" + ns.format.number(value, 2);
}

export function ram(ns, value) {
  return ns.format.ram(value, 2);
}

export function pct(value, decimals = 2) {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function age(ms) {
  if (!Number.isFinite(ms)) return "unknown";

  const seconds = Math.floor(ms / 1000);
  if (seconds < 5) return "now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
