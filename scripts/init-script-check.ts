/**
 * Init Script's worth (session 75): what its Data payout does to runs.
 * Two passes over every class:
 *
 * - natural: the simulated player meets Init Script as any player would
 *   (its Mod ladder ranks by rarity and synergy, not by the payout, so
 *   its pick rate doesn't move with INIT_SCRIPT_DATA_BONUS);
 * - forced: every run starts owning it (ownedModIdsOverride), which
 *   isolates the Mod's value from how often it's picked.
 *
 * The payout is read back from each run's Mods: every Mod after Init
 * Script in ownedModIds was gained while holding it. To compare amounts,
 * change INIT_SCRIPT_DATA_BONUS in src/engine/mods.ts and run again.
 *
 * Usage:
 *   npx tsx scripts/init-script-check.ts [--seeds=100] [--mode=every|once]
 *   (--mode labels the payout rule the engine has, for the Data column)
 */
import { runRequests, opportunisticTraversal, type RunOptions } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';
import { ALL_CLASS_IDS } from '../src/engine/classes';
import { INIT_SCRIPT_DATA_BONUS } from '../src/engine/mods';
import type { ShopAction } from '../src/engine/run-requests';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const seeds = Number(args.seeds ?? 100);
const every = (args.mode ?? 'every') === 'every';

type Tally = { runs: number; wins: number; modsWin: number; owned: number; ownedWins: number; after: number; paid: number; bought: number; dataLeft: number };
const empty = (): Tally => ({ runs: 0, wins: 0, modsWin: 0, owned: 0, ownedWins: 0, after: 0, paid: 0, bought: 0, dataLeft: 0 });

function pass(force: boolean): Tally {
  const t = empty();
  for (const classId of ALL_CLASS_IDS) {
    for (let seed = 0; seed < seeds; seed++) {
      const options: RunOptions = { ...SYNERGY_AWARE_PROFILE, seed, classId, traversalStrategy: opportunisticTraversal, safehouseStrategy: opportunisticSafehouseStrategy, playerSkill: 0.85 };
      if (force) options.ownedModIdsOverride = ['init-script'];
      const run = runRequests(options);
      let step = run.next();
      while (!step.done) {
        const req = step.value;
        const answer = req.fallback();
        if (req.kind === 'shop') {
          const a = answer as ShopAction;
          if (a.kind === 'buy' && a.slate === 'mod' && req.shop.slates.mod[a.index]?.mod.id === 'init-script') t.bought++;
        }
        step = run.next(answer);
      }
      const r = step.value;
      const mods = r.playerState.ownedModIds;
      const at = mods.indexOf('init-script');
      t.runs++;
      t.dataLeft += r.playerState.data;
      if (r.outcome === 'victory') {
        t.wins++;
        t.modsWin += mods.length - 1;
      }
      if (at >= 0) {
        const after = mods.length - 1 - at;
        t.owned++;
        t.after += after;
        t.paid += every ? after * INIT_SCRIPT_DATA_BONUS : Math.min(after, 1) * INIT_SCRIPT_DATA_BONUS;
        if (r.outcome === 'victory') t.ownedWins++;
      }
    }
  }
  return t;
}

const pct = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1) + '%' : '-');
const avg = (a: number, b: number) => (b ? (a / b).toFixed(1) : '-');
const show = (label: string, t: Tally) =>
  console.log(
    `${label.padEnd(8)} runs ${t.runs}  victory ${pct(t.wins, t.runs)}  Mods (winning runs) ${avg(t.modsWin, t.wins)}  ` +
      `owns Init Script ${pct(t.owned, t.runs)} (victory ${pct(t.ownedWins, t.owned)}, bought ${t.bought})  ` +
      `Mods after it ${avg(t.after, t.owned)}  Data paid ${avg(t.paid, t.owned)}  Data left at the end ${avg(t.dataLeft, t.runs)}`,
  );

console.log(`# Init Script: ${INIT_SCRIPT_DATA_BONUS} Data, ${every ? 'every Mod' : 'the next Mod only'}; ${seeds} seeds x ${ALL_CLASS_IDS.length} classes, skill 0.85`);
show('natural', pass(false));
show('forced', pass(true));
