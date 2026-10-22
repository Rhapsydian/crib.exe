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
  map: "This is the network map. You start at the bottom; the gatekeeper ⛨ at the top is the way out. Tap a linked node to see what it is, then move. Every move adds Heat (top bar): reach this layer's limit and you're caught.",
  class:
    "You're playing Blackhat. Your loadout of subroutines is on the left (the loadout button on phones). Your class Mod, Lateral Movement, gives you a little extra initiative for each pair you score.",
  fight:
    'Every fight is a game of Cribbage. The points you score fill your initiative (INIT): when it fills, you take a turn and every subroutine in your loadout fires, top to bottom. Fill your Breach before the enemy fills its Containment.',
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
    "You're carrying a Burner: a one-use item. Arm it with its button under your gauges, and it's used at the start of your next turn. Flash Drive Credits 5 at once.",
  burnerFired: 'Your Burner fired at the start of the turn, then it was spent.',
  shop: 'The Shop: spend Data on subroutines, Mods (permanent effects for the run) and Burners. Tap one to read it, then buy. You can also sell subroutines you no longer use.',
  safehouse:
    "A Safehouse gives you one choice. Rest to lower your Heat, or Merge: spend your banked spare copies to rank subroutines up, each rank making a Hook stronger. You have a spare Port Scan banked.",
  gatekeeperNear:
    "The gatekeeper is next. Beat it to breach the layer; lose and you're quarantined, which ends the run. Beating it also costs a Heat toll, bigger the closer it came to containing you (the Heat bar at the top of the fight shows it). If the toll maxes your Heat, you must outscore it in 3 hands of Cribbage to slip away.",
  gatekeeper:
    "Gatekeepers bend a rule with their own Mod. Firewall Beta's, Rate Limit: you can't gain more than 8 Credit in a single turn. Tap its Mod (◆) to read it.",
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

  /** "Got it": the next step, if one is waiting. */
  dismiss(): void {
    this.current = this.#queue.shift() ?? null;
  }
}

export const guide = new Guide();
