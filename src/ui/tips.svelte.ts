/**
 * First-time tips (session 63, docs/tutorial-design.md T6): a one-line
 * banner the first time a player meets each mechanic the guided run
 * doesn't cover. Shown once per mechanic, remembered per browser; the
 * main menu's "show tips again" resets them (a new tester on the same
 * machine). Screens call `tips.offer(id)` when the mechanic shows up;
 * TipBanner shows them one at a time.
 */

export type TipId = 'elite' | 'event' | 'cache' | 'quarantine' | 'heat' | 'rank' | 'mods' | 'instant' | 'enemyEffects' | 'strain' | 'gauges3' | 'gauges4';

export const TIP_TEXT: Record<TipId, string> = {
  elite: 'Elites are tougher than regular fights and bend one rule with their own Mod. Beat one and choose a subroutine or a Mod.',
  event: 'Events are a gamble: pick a choice and see what happens. Some cost Heat, some start a fight.',
  cache: 'A Cache is a free reward for the detour: a rarer subroutine, a Mod, or Data, and always a Burner.',
  // One card for the gatekeeper and its toll (session 63, the user's call:
  // they were two cards back to back).
  quarantine:
    "Each layer ends with a gatekeeper. Win to breach the layer; lose and you're quarantined, ending the run. Winning still costs a Heat toll, and if that maxes out your Heat, you must outscore it over 3 hands of Cribbage to evade a run-ending trace.",
  heat: "Your Heat is past three-quarters of this layer's limit. Reach the limit and you're caught; resting at a Quiet Host or clearing the gatekeeper lowers it.",
  rank: 'Refactored subroutines show their rank (I-III): each rank makes the Hook stronger, and rank III makes the Process stronger too. Spare copies bank until a Quiet Host Refactor.',
  mods: 'Your Mods are permanent effects for the run. Tap one to read it; some act in fights, others on the map or in Shops.',
  instant: "An Instant Hook just went off between turns: it doesn't wait for your turn to fire.",
  strain: 'System strain: taking four or more turns in a row pushes the system too hard. Each extra turn adds Heat, doubling every time.',
  // Session 68 (docs/enemies-design.md E9, the user's wording): at the
  // first elite or gatekeeper fight on layers 3 and 4.
  gauges3: 'The deeper you go, the bigger the systems: from layer 3, elite and gatekeeper Breach and Containment gauges are bigger, so those fights take longer to win, and to lose.',
  gauges4: 'The core runs the biggest systems: elite and gatekeeper Breach and Containment gauges are bigger still.',
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
