/** @param {NS} ns **/
export async function main(ns) {
  ns.disableLog("ALL");

  const flags = ns.flags([
    ["trainTo", 35],
    ["minCrimeChance", 0.55],
    ["gym", "Powerhouse Gym"],
    ["city", "Sector-12"],
    ["tick", 5000],
    ["focus", false],
  ]);

  const CRIMES = [
    "Shoplift",
    "Mug",
    "Rob Store",
    "Larceny",
    "Deal Drugs",
    "Bond Forgery",
    "Traffick Arms",
    "Homicide",
    "Grand Theft Auto",
    "Kidnap",
    "Assassination",
    "Heist",
  ];

  const COMBAT_STATS = [
    "strength",
    "defense",
    "dexterity",
    "agility",
  ];

  ns.tprint("PaggerOS Auto-Start daemon online.");

  if (ns.singularity.travelToCity) {
    try {
      ns.singularity.travelToCity(flags.city);
    } catch {
      // Not fatal. You might already be there or lack Singularity access.
    }
  }

  while (true) {
    try {
      const player = ns.getPlayer();
      const skills = player.skills ?? player;

      const combat = getCombatStats(skills);
      const weakest = getWeakestCombatStat(combat);

      // Phase 1: stop being made of wet cardboard
      if (combat[weakest] < flags.trainTo) {
        await trainCombat(ns, flags.gym, weakest, flags.focus, flags.tick);
        continue;
      }

      // Phase 2: crime with sane odds
      const crime = chooseBestCrime(ns, CRIMES, flags.minCrimeChance);

      if (!crime) {
        // If nothing worthwhile is safe enough, train the weakest stat again.
        await trainCombat(ns, flags.gym, weakest, flags.focus, flags.tick);
        continue;
      }

      const chance = ns.singularity.getCrimeChance(crime);
      const time = ns.singularity.commitCrime(crime, flags.focus);

      ns.print(`Crime: ${crime} | Chance: ${(chance * 100).toFixed(1)}% | Time: ${(time / 1000).toFixed(1)}s`);

      await ns.sleep(time + 250);
    } catch (err) {
      ns.print(`Auto-Start error: ${String(err)}`);
      await ns.sleep(5000);
    }
  }
}

function getCombatStats(skills) {
  return {
    strength: skills.strength ?? 1,
    defense: skills.defense ?? 1,
    dexterity: skills.dexterity ?? 1,
    agility: skills.agility ?? 1,
  };
}

function getWeakestCombatStat(combat) {
  return Object.entries(combat)
    .sort((a, b) => a[1] - b[1])[0][0];
}

async function trainCombat(ns, gym, stat, focus, duration) {
  const gymTypeMap = {
    strength: "str",
    defense: "def",
    dexterity: "dex",
    agility: "agi",
  };

  const gymType = gymTypeMap[stat];

  if (!gymType) {
    ns.print(`Unknown gym stat: ${stat}`);
    await ns.sleep(1000);
    return;
  }

  const started = ns.singularity.gymWorkout(gym, gymType, focus);

  if (started) {
    ns.print(`Training ${stat} at ${gym}`);
    await ns.sleep(duration);
    ns.singularity.stopAction();
  } else {
    ns.print(`Could not train ${stat} at ${gym}. Falling back to crime.`);
    await ns.sleep(1000);
  }
}

function chooseBestCrime(ns, crimes, minChance) {
  let best = null;
  let bestScore = -Infinity;

  for (const crime of crimes) {
    const chance = ns.singularity.getCrimeChance(crime);
    const stats = ns.singularity.getCrimeStats(crime);

    if (chance < minChance) continue;

    const timeSeconds = stats.time / 1000;

    const combatXp =
      (stats.strength_exp ?? 0) +
      (stats.defense_exp ?? 0) +
      (stats.dexterity_exp ?? 0) +
      (stats.agility_exp ?? 0);

    const expectedMoneyPerSecond = ((stats.money ?? 0) * chance) / timeSeconds;
    const expectedCombatXpPerSecond = (combatXp * chance) / timeSeconds;

    // Weighted score: money matters, but combat XP matters a lot early on.
    const score = expectedMoneyPerSecond + expectedCombatXpPerSecond * 5000;

    if (score > bestScore) {
      bestScore = score;
      best = crime;
    }
  }

  return best;
}