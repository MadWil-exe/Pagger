/** @param {NS} ns */
export async function main(ns) {
  const owner = "MadWil-exe";
  const repo = "Pagger";
  const branch = "main";

  const baseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}`;
  const manifestPath = "manifest.json";
  const manifestUrl = `${baseUrl}/${manifestPath}`;

  ns.tprint("PaggerOS installer starting...");
  ns.tprint(`Manifest: ${manifestUrl}`);

  const ok = await ns.wget(manifestUrl, "/tmp-paggeros-manifest.json", "home");

  if (!ok) {
    ns.tprint("ERROR: Could not download manifest.");
    ns.tprint("Check the repo is public and the GitHub URL is correct.");
    return;
  }

  let manifest;

  try {
    manifest = JSON.parse(ns.read("/tmp-paggeros-manifest.json"));
  } catch (error) {
    ns.tprint("ERROR: Manifest downloaded but could not be parsed as JSON.");
    ns.tprint(String(error));
    return;
  }

  if (!manifest.files || !Array.isArray(manifest.files)) {
    ns.tprint("ERROR: Manifest does not contain a valid files array.");
    return;
  }

  ns.tprint(`Installing ${manifest.name ?? "PaggerOS"} ${manifest.version ?? ""}`);
  ns.tprint(`Files: ${manifest.files.length}`);

  let failed = 0;

  for (const file of manifest.files) {
    const url = `${baseUrl}/${file}`;
    const target = `/${file}`;

    ns.tprint(`Downloading ${target}`);

    const downloaded = await ns.wget(url, target, "home");

    if (!downloaded) {
      failed++;
      ns.tprint(`FAILED: ${file}`);
    }
  }

  ns.rm("/tmp-paggeros-manifest.json", "home");

  if (failed > 0) {
    ns.tprint(`PaggerOS install completed with ${failed} failed download(s).`);
    ns.tprint("Check the failed paths against manifest.json.");
    return;
  }

  ns.tprint("PaggerOS install complete.");
  ns.tprint("Run it with:");
  ns.tprint("run /PaggerOS/kernel.js");
}
