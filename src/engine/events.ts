import type { EventDefinition } from './event-types';
import { authoredPiece } from './content/starting-loadouts';
import { MOD_DEFINITIONS } from './mods';
import { BURNER_DEFINITIONS } from './burners';

/**
 * Event content (Phase 5 checkpoint G): the 8 validated Events from
 * session 37's content-validation table. Mirrors enemies.ts's own
 * ENEMY_ROSTER-as-plain-array pattern -- this file is the roster (id,
 * name, choices); real choice resolution lives in encounters.ts's
 * extended `event` case (checkpoint H), since there's no registry/
 * hook-fan-out shape here the way Mods needed one.
 *
 * Coverage (session 37's validation pass, mirrored here): all 3 risk
 * tiers, every EventEffect kind (Heat delta, Data delta, subroutine/Mod/
 * Burner grant, bonus fight), both Grant<T> mechanisms (a named specific
 * piece and a rarity-filtered random draw). All numbers are
 * TBD/playtesting placeholders, same discipline as every other numeric
 * constant in this project.
 */

export const EVENT_ROSTER: EventDefinition[] = [
  {
    id: 'dead-mans-switch',
    name: "Dead Man's Switch",
    choices: [
      {
        id: 'defuse',
        label: 'Defuse it quietly',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { heatLosses: -0.27 } }],
      },
      {
        id: 'repurpose',
        label: 'Repurpose its trigger logic',
        riskTier: 'visibleOdds',
        outcomes: [
          { probability: 0.65, effect: { modGrant: { specific: MOD_DEFINITIONS['surge-protector'] } } }, // was Static Shield, set aside (session 58)
          { probability: 0.35, effect: { heatLosses: 0.4 } },
        ],
      },
      {
        id: 'detonate',
        label: 'Let it detonate and salvage the wreckage',
        riskTier: 'gamble',
        outcomes: [
          { probability: 0.5, effect: { subroutineGrant: { randomFromRarity: 'rare' } } },
          { probability: 0.5, effect: { heatLosses: 0.93 } },
        ],
      },
    ],
  },
  {
    id: 'abandoned-session',
    name: 'Abandoned Session',
    // Pure-transparent (session 37's coverage note): every choice is
    // safe/stated up front, no visibleOdds or gamble tier at all.
    choices: [
      {
        id: 'copy-data',
        label: 'Copy what data remains',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { dataDelta: 12 } }],
      },
      {
        id: 'wipe-and-leave',
        label: 'Wipe the session and leave',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { heatLosses: -0.27 } }],
      },
    ],
  },
  {
    id: 'vendor-backdoor',
    name: 'Vendor Backdoor',
    choices: [
      {
        id: 'ignore',
        label: "Ignore it -- not worth the risk",
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: {} }],
      },
      {
        id: 'exploit',
        label: 'Exploit the backdoor',
        riskTier: 'visibleOdds',
        outcomes: [
          { probability: 0.6, effect: { dataDelta: 22 } },
          { probability: 0.4, effect: { heatLosses: 0.6 } },
        ],
      },
    ],
  },
  {
    id: 'the-whistleblower',
    name: 'The Whistleblower',
    choices: [
      {
        id: 'decline',
        label: "Decline -- it's not your problem",
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: {} }],
      },
      {
        id: 'listen',
        label: 'Hear them out',
        riskTier: 'gamble',
        outcomes: [
          // Step 3: the whistleblower hands over stolen credentials --
          // Credential Stuffing (Exploit uncommon). Off-class for half the
          // classes, as Probe was before it.
          { probability: 0.5, effect: { subroutineGrant: { specific: authoredPiece('credential-stuffing') } } },
          { probability: 0.5, effect: { heatLosses: 0.73 } },
        ],
      },
    ],
  },
  {
    id: 'salvage-run',
    name: 'Salvage Run',
    choices: [
      {
        id: 'pass',
        label: 'Pass -- keep moving',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: {} }],
      },
      {
        id: 'salvage',
        label: 'Force a fight for the salvage',
        riskTier: 'gamble',
        outcomes: [{ probability: 1, effect: { bonusFight: { tier: 'regular' } } }],
      },
    ],
  },
  {
    id: 'compromised-coworker',
    name: 'Compromised Coworker',
    choices: [
      {
        id: 'report-them',
        label: 'Report them for the bounty',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { dataDelta: 10 } }],
      },
      {
        id: 'cover-for-them',
        label: 'Cover for them',
        riskTier: 'visibleOdds',
        outcomes: [
          { probability: 0.55, effect: { modGrant: { randomFromRarity: 'uncommon' } } },
          { probability: 0.45, effect: { heatLosses: 0.5 } },
        ],
      },
    ],
  },
  {
    id: 'encrypted-cache',
    name: 'Encrypted Cache',
    choices: [
      {
        id: 'leave-it',
        label: 'Leave it encrypted',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: {} }],
      },
      {
        id: 'crack-it',
        label: 'Crack it open',
        riskTier: 'gamble',
        outcomes: [
          { probability: 0.4, effect: { burnerGrant: { randomFromRarity: 'rare' } } },
          { probability: 0.6, effect: { heatLosses: 0.67 } },
        ],
      },
    ],
  },
  {
    id: 'rival-hackers-dead-drop',
    name: "Rival Hacker's Dead Drop",
    choices: [
      {
        id: 'walk-away',
        label: 'Walk away',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { dataDelta: 5 } }],
      },
      {
        id: 'negotiate',
        label: 'Negotiate a cut',
        riskTier: 'visibleOdds',
        outcomes: [
          { probability: 0.65, effect: { dataDelta: 20 } },
          { probability: 0.35, effect: { heatLosses: 0.33 } },
        ],
      },
      {
        id: 'steal-it',
        label: 'Take the whole drop',
        riskTier: 'gamble',
        outcomes: [
          { probability: 0.45, effect: { burnerGrant: { specific: BURNER_DEFINITIONS['skeleton-key'] } } },
          { probability: 0.55, effect: { heatLosses: 0.83 } },
        ],
      },
    ],
  },
];
