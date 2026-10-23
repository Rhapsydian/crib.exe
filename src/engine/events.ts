import type { EventDefinition } from './event-types';
import { authoredPiece } from './content/starting-loadouts';
import { MOD_DEFINITIONS } from './mods';

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
    text:
      'A forgotten maintenance script is still counting down in the backbone: whoever wrote it never came back to disarm it. Its trigger logic is elegant. Its payload is not.',
    choices: [
      {
        id: 'defuse',
        label: 'Defuse it quietly',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { heatLosses: -0.27 }, text: 'You walk the countdown back one second at a time. The logs around it go quiet, and so does your trail.' }],
      },
      {
        id: 'repurpose',
        label: 'Repurpose its trigger logic',
        riskTier: 'visibleOdds',
        outcomes: [
          { probability: 0.65, effect: { modGrant: { specific: MOD_DEFINITIONS['surge-protector'] } }, text: 'You graft its trigger onto your own toolkit. It answers to you now.' }, // was Static Shield, set aside (session 58)
          { probability: 0.35, effect: { heatLosses: 0.4 }, text: 'The trigger fires early. Every monitor on the segment looks up at once.' },
        ],
      },
      {
        id: 'detonate',
        label: 'Let it detonate and salvage the wreckage',
        riskTier: 'gamble',
        outcomes: [
          { probability: 0.5, effect: { subroutineGrant: { randomFromRarity: 'rare' } }, text: 'The payload tears a hole in the backbone. In the wreckage, something worth keeping.' },
          { probability: 0.5, effect: { heatLosses: 0.93 }, text: 'The blast lights up the whole segment, and you\'re the only thing still moving in it.' },
        ],
      },
    ],
  },
  {
    id: 'abandoned-session',
    name: 'Abandoned Session',
    text:
      'Someone logged in here and never logged out. The session is still open and still trusted, and the admin who owns it went home hours ago.',
    // Pure-transparent (session 37's coverage note): every choice is
    // safe/stated up front, no visibleOdds or gamble tier at all.
    choices: [
      {
        id: 'copy-data',
        label: 'Copy what data remains',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { dataDelta: 12 }, text: 'You pull what you can before the session times out.' }],
      },
      {
        id: 'wipe-and-leave',
        label: 'Wipe the session and leave',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { heatLosses: -0.27 }, text: 'You close it cleanly, and your own footprints go with it.' }],
      },
    ],
  },
  {
    id: 'vendor-backdoor',
    name: 'Vendor Backdoor',
    text:
      'A third-party maintenance tool still has the password it shipped with. Nobody ever changed it. It\'s an open door, if nobody\'s watching it.',
    choices: [
      {
        id: 'ignore',
        label: "Ignore it: not worth the risk",
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: {}, text: 'You leave the door for someone else to find.' }],
      },
      {
        id: 'exploit',
        label: 'Exploit the backdoor',
        riskTier: 'visibleOdds',
        outcomes: [
          { probability: 0.6, effect: { dataDelta: 22 }, text: 'The door swings open onto the vendor\'s billing records, and nothing stirs.' },
          { probability: 0.4, effect: { heatLosses: 0.6 }, text: 'The vendor\'s monitoring was better than its passwords. Alarms.' },
        ],
      },
    ],
  },
  {
    id: 'the-whistleblower',
    name: 'The Whistleblower',
    text:
      'A message arrives on a channel you thought was yours alone. Someone inside wants out, and they\'ll trade what they know for a way to disappear.',
    choices: [
      {
        id: 'decline',
        label: "Decline: it's not your problem",
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: {}, text: 'You let the message expire unread.' }],
      },
      {
        id: 'listen',
        label: 'Hear them out',
        riskTier: 'gamble',
        outcomes: [
          // Step 3: the whistleblower hands over stolen credentials --
          // Credential Stuffing (Exploit uncommon). Off-class for half the
          // classes, as Probe was before it.
          { probability: 0.5, effect: { subroutineGrant: { specific: authoredPiece('credential-stuffing') } }, text: 'Their credentials check out. You keep a few for yourself.' },
          { probability: 0.5, effect: { heatLosses: 0.73 }, text: 'It was a sting. Security was reading every word.' },
        ],
      },
    ],
  },
  {
    id: 'salvage-run',
    name: 'Salvage Run',
    text:
      'A half-dismantled server rack sits behind a guard process that\'s still running. Whatever it\'s protecting, someone thought it was worth keeping.',
    choices: [
      {
        id: 'pass',
        label: 'Pass and keep moving',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: {}, text: 'You leave the rack to its guard.' }],
      },
      {
        id: 'salvage',
        label: 'Force a fight for the salvage',
        riskTier: 'gamble',
        outcomes: [{ probability: 1, effect: { bonusFight: { tier: 'regular' } }, text: 'The guard process wakes up.' }],
      },
    ],
  },
  {
    id: 'compromised-coworker',
    name: 'Compromised Coworker',
    text:
      'An employee\'s account is doing things it shouldn\'t, and it isn\'t you. Someone else is inside, wearing a stolen face.',
    choices: [
      {
        id: 'report-them',
        label: 'Report them for the bounty',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { dataDelta: 10 }, text: 'The bounty pays out, and the other intruder is locked out for good.' }],
      },
      {
        id: 'cover-for-them',
        label: 'Cover for them',
        riskTier: 'visibleOdds',
        outcomes: [
          { probability: 0.55, effect: { modGrant: { randomFromRarity: 'uncommon' } }, text: 'They return the favour with a tool of their own.' },
          { probability: 0.45, effect: { heatLosses: 0.5 }, text: 'Their sloppiness becomes yours. Security follows both trails.' },
        ],
      },
    ],
  },
  {
    id: 'encrypted-cache',
    name: 'Encrypted Cache',
    text:
      'A locked archive, its key long lost. The encryption is old, but cracking it will make noise.',
    choices: [
      {
        id: 'leave-it',
        label: 'Leave it encrypted',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: {}, text: 'You leave the archive sealed.' }],
      },
      {
        id: 'crack-it',
        label: 'Crack it open',
        riskTier: 'gamble',
        outcomes: [
          { probability: 0.4, effect: { burnerGrant: { randomFromRarity: 'rare' } }, text: 'The lock gives. Inside, a tool someone never meant to share.' },
          { probability: 0.6, effect: { heatLosses: 0.67 }, text: 'It takes too long. Every second of brute force lights up a dashboard somewhere.' },
        ],
      },
    ],
  },
  {
    id: 'rival-hackers-dead-drop',
    name: "Rival Hacker's Dead Drop",
    text:
      'Another crew uses this dead drop. Their package is waiting for someone, and that someone isn\'t here yet.',
    choices: [
      {
        id: 'walk-away',
        label: 'Walk away',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { dataDelta: 5 }, text: 'You leave the package, and pocket the little they left in plain sight.' }],
      },
      {
        id: 'negotiate',
        label: 'Negotiate a cut',
        riskTier: 'visibleOdds',
        outcomes: [
          { probability: 0.65, effect: { dataDelta: 20 }, text: 'They agree to split it, grudgingly.' },
          { probability: 0.35, effect: { heatLosses: 0.33 }, text: 'They don\'t negotiate. They report you.' },
        ],
      },
      {
        id: 'steal-it',
        label: 'Take the whole drop',
        riskTier: 'gamble',
        outcomes: [
          { probability: 0.45, effect: { burnerGrant: { contraband: true } }, text: 'You take everything. Buried in it: something you were never meant to have.' },
          { probability: 0.55, effect: { heatLosses: 0.83 }, text: 'The drop was trapped. Their alarm is now everyone\'s alarm.' },
        ],
      },
    ],
  },
];
