import { RATE_LIMIT_THRESHOLD } from '../engine/gatekeeper-mods';
import { BURNER_DEFINITIONS } from '../engine/burners';

// Flash Drive's Credit, read from the Burner itself (v0.9.1: the tip
// said 5 after the Burner became 10).
const flash = BURNER_DEFINITIONS['flash-drive'].combat?.effect;
const FLASH_CREDIT = flash?.kind === 'effect' && 'amount' in flash.effect ? flash.effect.amount : 0;
/**
 * The tutorial coach (session 63, docs/tutorial-design.md T1, T4-T5): in
 * the guided run only, it explains each new thing the first time it shows
 * up -- it reacts to what happens rather than following a script, so a
 * tester playing their own way still hears each explanation when its
 * moment comes. Screens call `guide.offer(step)` when a moment happens;
 * it does nothing outside the tutorial. Each step shows once per guided
 * run (a resumed tutorial may repeat one). Fights show the coach on the
 * table; every other screen, in a banner at the top (GuideBanner).
 */

export type GuideStep =
  | 'map'
  | 'class'
  | 'fight'
  | 'cribbageCoach'
  | 'turn'
  | 'hook'
  | 'enemyTurn'
  | 'won'
  | 'reward'
  | 'order'
  | 'burner'
  | 'burnerFired'
  | 'shop'
  | 'safehouse'
  | 'gatekeeperNear'
  | 'gatekeeper';

export const GUIDE_TEXT: Record<GuideStep, string> = {
  map: "This is the network map. You start at the bottom; the gatekeeper at the top is the way out. Tap a linked node to see what it is, then move. Every move adds Heat (top bar): reach this layer's limit and you're caught.",
  class:
    "You're playing Blackhat. Your loadout of subroutines is on the left (the loadout button on phones). Your class Mod, Lateral Movement, gives you a little extra initiative for each pair you score.",
  fight:
    // Session 69 (a tester's note): say outright that points never fill Breach.
    'Every fight is a game of Cribbage. The points you score fill only your initiative (INIT), never your Breach: when initiative fills, you take a turn and every subroutine in your loadout fires, top to bottom. Your subroutines fill your Breach. Fill it before the enemy fills its Containment.',
  cribbageCoach:
    'Want help with the card play? Tap ◈ coach at the top for advice on each discard and play, and feedback on the choices you made. Tap it again to turn it off.',
  turn: 'Your turn: each subroutine fired its Process, top to bottom. Most Credit, which fills your Breach. Tap any subroutine to read what it does.',
  hook: "A Hook just went off: when a subroutine's condition is met (here, scoring fifteens or pairs), it does more than its Process. The number on a subroutine counts toward its Hook.",
  enemyTurn: "The enemy's turn: its points fill its initiative too, and its subroutines fill its Containment. Outscore it at Cribbage to take more turns than it does.",
  won: 'Breached! A win pays Data, adds some Heat, and offers a reward.',
  reward: 'Pick a new subroutine (or skip). It goes to the bottom of your loadout.',
  order:
    "Order matters: your loadout fires top to bottom, and some subroutines help the one below (Cache Hit Empowers the next one). Tap a subroutine in your loadout to move it up or down.",
  burner:
    `You're carrying a Burner: a one-use item. Arm it with its button under your gauges, and it's used at the start of your next turn. Flash Drive Credits ${FLASH_CREDIT} at once.`,
  burnerFired: 'Your Burner fired at the start of the turn, then it was spent.',
  shop: 'The Shop: spend Data on subroutines, Mods (permanent effects for the run) and Burners. Tap one to read it, then buy. You can also sell subroutines you no longer use.',
  safehouse:
    "A Quiet Host gives you one choice. Rest to lower your Heat, or Refactor: spend your banked spare copies to rank subroutines up, each rank making a Hook stronger. You have spare Port Scan copies banked.",
  gatekeeperNear:
    "The gatekeeper is next. Beat it to breach the layer; lose and you're quarantined, which ends the run. Winning also costs Heat: a toll that grows the closer it came to containing you, shown on the Heat bar during the fight. If the toll maxes out your Heat, you must outscore it over 3 hands of Cribbage to escape.",
  gatekeeper:
    `Gatekeepers bend a rule with their own Mod. Firewall Beta's, Rate Limit: Credit you gain past ${RATE_LIMIT_THRESHOLD} in a single turn is halved. Tap its Mod (◆) to read it.`,
};

/** The screen each step belongs to (session 72, the user's report: the
 * reward explanation, queued behind "Breached!", followed the player into
 * the next fight). Leaving a screen drops its steps still waiting. */
export type GuideScreen = 'map' | 'fight' | 'reward' | 'shop' | 'safehouse';
const STEP_SCREEN: Record<GuideStep, GuideScreen> = {
  map: 'map',
  class: 'map',
  order: 'map',
  gatekeeperNear: 'map',
  fight: 'fight',
  cribbageCoach: 'fight',
  turn: 'fight',
  hook: 'fight',
  enemyTurn: 'fight',
  burner: 'fight',
  burnerFired: 'fight',
  gatekeeper: 'fight',
  won: 'reward',
  reward: 'reward',
  shop: 'shop',
  safehouse: 'safehouse',
};

class Guide {
  /** True during the guided run. */
  active = $state(false);
  /** The step on screen, if any. */
  current = $state<GuideStep | null>(null);
  /** A fight is on screen: the coach speaks over its table, not in the
   * top banner. */
  inFight = $state(false);
  /** The Cribbage coach in the guided run's fights (T3): a switch,
   * starting off; its suggestions start on, as in Play Cribbage. */
  cribbageCoach = $state(false);
  cribbageHints = $state(true);
  #queue: GuideStep[] = [];
  #seen = new Set<GuideStep>();

  /** A guided run started (or resumed): every step can show again. */
  start(): void {
    this.active = true;
    this.#seen.clear();
    this.#queue = [];
    this.current = null;
    this.cribbageCoach = false;
    this.cribbageHints = true;
  }

  stop(): void {
    this.active = false;
    this.cribbageCoach = false;
    this.#queue = [];
    this.current = null;
  }

  /** A moment happened: queue its step, once per guided run. */
  offer(step: GuideStep): void {
    if (!this.active || this.#seen.has(step)) return;
    this.#seen.add(step);
    if (this.current === null) this.current = step;
    else this.#queue.push(step);
  }

  /** A screen comes up: steps belonging to another screen, on screen or
   * waiting, are dropped, and can show again when their moment next comes
   * (they weren't read). */
  enter(screen: GuideScreen | null): void {
    const stale = (s: GuideStep) => STEP_SCREEN[s] !== screen;
    for (const s of this.#queue.filter(stale)) this.#seen.delete(s);
    this.#queue = this.#queue.filter((s) => !stale(s));
    if (this.current && stale(this.current)) {
      this.#seen.delete(this.current);
      this.current = this.#queue.shift() ?? null;
    }
  }

  /** "Got it": the next step, if one is waiting. */
  dismiss(): void {
    this.current = this.#queue.shift() ?? null;
  }
}

export const guide = new Guide();
