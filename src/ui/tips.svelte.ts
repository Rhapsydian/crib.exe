/**
 * First-time tips (session 63, docs/tutorial-design.md T6): a one-line
 * banner the first time a player meets each mechanic the guided run
 * doesn't cover. Shown once per mechanic, remembered per browser; the
 * main menu's "show tips again" resets them (a new tester on the same
 * machine). Screens call `tips.offer(id)` when the mechanic shows up;
 * TipBanner shows them one at a time.
 */

export type TipId = 'elite' | 'event' | 'cache' | 'quarantine' | 'toll' | 'heat' | 'rank' | 'mods' | 'instant' | 'enemyEffects';

export const TIP_TEXT: Record<TipId, string> = {
  elite: 'Elites are tougher than regular fights and bend one rule with their own Mod. Beat one and choose a subroutine or a Mod.',
  event: 'Events are a gamble: pick a choice and see what happens. Some cost Heat, some start a fight.',
  cache: 'A Cache is a free reward for the detour: a rarer subroutine, a Mod, or Data, and always a Burner.',
  quarantine: "Each layer ends with a gatekeeper. Beat it to move on; lose and you're quarantined, which ends the run.",
  toll: "Beating a gatekeeper costs Heat too: a toll charged after the fight, bigger the closer it came to containing you. If the toll takes you past this layer's limit, it tries to trace you: a 3-hand game of plain Cribbage, with a head start for how close it came, that you must win to slip away. Its card shows the toll; in the fight, the Heat bar shows what a win would cost.",
  heat: "Your Heat is past three-quarters of this layer's limit. Reach the limit and you're caught; resting at a Safehouse or clearing the gatekeeper lowers it.",
  rank: 'Merged subroutines show their rank (I-III): each rank makes the Hook stronger. Spare copies bank until a Safehouse Merge.',
  mods: 'Your Mods are permanent effects for the run. Tap one to read it; some act in fights, others on the map or in Shops.',
  instant: "An Instant Hook just went off between turns: it doesn't wait for your turn to fire.",
  enemyEffects: 'This enemy can work against your build: Wipe takes counts from your Hooks, Strip takes your Ward, Trace gives you Heat.',
};

const SEEN_KEY = 'cribexe.tipsSeen';

function loadSeen(): Set<TipId> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw) return new Set(JSON.parse(raw) as TipId[]);
  } catch {
    // Storage can be unavailable (private windows); tips then show once a session.
  }
  return new Set();
}

class Tips {
  /** The tip on screen, if any. */
  current = $state<TipId | null>(null);
  /** Held back during the guided run, whose coach covers the same ground. */
  suspended = false;
  #queue: TipId[] = [];
  #seen = loadSeen();

  /** A mechanic just showed up: queue its tip, unless it's been seen. */
  offer(id: TipId): void {
    if (this.suspended || this.#seen.has(id) || this.current === id || this.#queue.includes(id)) return;
    if (this.current === null) this.current = id;
    else this.#queue.push(id);
  }

  /** "Got it": the tip on screen is seen for good; the next one shows. */
  dismiss(): void {
    if (this.current === null) return;
    this.#seen.add(this.current);
    this.#save();
    this.current = this.#queue.shift() ?? null;
  }

  /** "Show tips again" (the main menu). */
  reset(): void {
    this.#seen.clear();
    this.#queue = [];
    this.current = null;
    this.#save();
  }

  #save(): void {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...this.#seen]));
    } catch {
      // See loadSeen.
    }
  }
}

export const tips = new Tips();
