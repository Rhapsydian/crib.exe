import type { SubroutineDefinition } from '../subroutine-types';
import type { ClassId } from '../classes';
import { EXPLOIT_POOL } from './exploit';
import { DAEMON_POOL } from './daemon';
import { OVERCLOCK_POOL } from './overclock';
import { HONEYPOT_POOL } from './honeypot';

/**
 * The authored classes' starting loadouts (step 3; `docs/archive/authoring-design.md`
 * C3). Commons only, in loadout order. Each follows A9 (offense with a
 * credit path, utility from the other archetype, a piece that shows off
 * the bridge). Exploit classes start with the noisy Fuzzer (Exploit's Heat
 * identity); Honeypot classes carry plain-Credit partner pieces (S11).
 * Priced by `scripts/class-check.ts`.
 *
 * Wired: `CLASS_STARTING_LOADOUTS` (subroutines.ts) uses these.
 */

const ALL = [EXPLOIT_POOL, DAEMON_POOL, OVERCLOCK_POOL, HONEYPOT_POOL].flatMap((p) => [...p.commons, ...p.uncommons, ...p.rares]);
/** An authored piece by id; throws on a typo rather than starting a class short. */
export function authoredPiece(id: string): SubroutineDefinition {
  const found = ALL.find((x) => x.id === id);
  if (!found) throw new Error(`no authored piece ${id}`);
  return found;
}
const p = authoredPiece;

export const AUTHORED_STARTING_LOADOUTS: Record<ClassId, SubroutineDefinition[]> = {
  // Fuzzer's beta fires often, so the bridge Empowers Cache Hit, which
  // Empowers Port Scan: spike -> boost -> spike.
  'exploit-overclock': [p('fuzzer'), p('cache-hit'), p('port-scan')],
  // Fifteens matter (Buffer Overflow) and each also Suppresses (bridge);
  // Cron Job ramps once the healing stretches the fight.
  'exploit-daemon': [p('buffer-overflow'), p('fuzzer'), p('cron-job')],
  // Ping's extra fires grow both Daemon pieces two steps each (bridge).
  // Steady Drip, not Elevated Session: the bridge multiplies Overclock
  // betas by Daemon growth pieces, and two of the latter price it on
  // budget (0.82 vs 0.56).
  'daemon-overclock': [p('cron-job'), p('ping'), p('steady-drip')],
  // Pairs bank Ward (bridge); Tarpit spends it.
  'exploit-honeypot': [p('port-scan'), p('tarpit'), p('fuzzer')],
  // Watchdog's Suppress banks Ward (bridge); Tarpit spends it.
  'daemon-honeypot': [p('cron-job'), p('watchdog-timer'), p('tarpit')],
  // Every turn banks Ward (bridge); Tarpit converts it.
  'overclock-honeypot': [p('ping'), p('tarpit'), p('rate-limiting')],
};
