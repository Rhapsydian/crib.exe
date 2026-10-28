import type { EventChoice, EventDefinition } from './event-types';
import type { ModId } from './mod-types';
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

/** Clean Room's Data price for the class Mod upgrade, and Dead Man's
 * Login's for Ghost Credentials (session 65, measured: the simulated
 * player holds a median 41 Data at layer-1 Events, 93-96 at layers 2-3;
 * Clean Room's sure upgrade costs about what you hold by then). */
export const CLEAN_ROOM_DATA = 90;
export const DEAD_MANS_LOGIN_DATA = 40;

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
      "A server rack slated for decommissioning still has power, and its old security daemon is still standing guard over the drives. Whatever's on them, someone thought it was worth protecting.",
    choices: [
      {
        id: 'pass',
        label: 'Pass and keep moving',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: {}, text: 'You leave the rack to its daemon.' }],
      },
      {
        id: 'salvage',
        label: 'Force a fight for the salvage',
        riskTier: 'gamble',
        outcomes: [{ probability: 1, effect: { bonusFight: { tier: 'regular' } }, text: 'The security daemon wakes up.' }],
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
  // --- Session 64's first batch (docs/design/burners-events.md BE8-BE10):
  // pitfalls, bargains, gambles; contraband mostly behind a gamble; some
  // only on deeper layers. Heat in multiples of the layer's elite-loss
  // charge (about 15 at layer 1): small 0.27, medium 0.53, large 0.93.
  {
    id: 'honeypot-lure',
    name: 'Honeypot Lure',
    text: "An unguarded file share, full of exactly what you came for. It's too easy, and you know it.",
    choices: [
      {
        id: 'walk-away',
        label: 'Walk away',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: {}, text: 'You leave the bait where it is. Somewhere, a trap stays unsprung.' }],
      },
      {
        id: 'sample',
        label: 'Take a careful sample',
        riskTier: 'visibleOdds',
        outcomes: [
          { probability: 0.7, effect: { dataDelta: 15 }, text: 'A few files, quietly. Nothing notices.' },
          { probability: 0.3, effect: { heatLosses: 0.53 }, text: 'The files are marked. Somewhere, a counter ticks up.' },
        ],
      },
      {
        id: 'grab-it-all',
        label: 'Grab it all',
        riskTier: 'gamble',
        outcomes: [
          { probability: 0.3, effect: { dataDelta: 40 }, text: "It wasn't a trap after all. Just someone's very bad day." },
          { probability: 0.7, effect: { bonusFight: { tier: 'elite' } }, text: 'The share was a lure. Something wakes up.' },
        ],
      },
    ],
  },
  {
    id: 'darknet-broker',
    name: 'The Darknet Broker',
    minLayer: 2,
    text: "A broker on a darknet relay deals in things that don't officially exist. Payment up front, no refunds, no questions.",
    choices: [
      {
        id: 'pay-data',
        label: 'Pay in Data',
        riskTier: 'transparent',
        requiresData: 45,
        outcomes: [{ probability: 1, effect: { dataDelta: -45, burnerGrant: { contraband: true } }, text: 'The broker counts the payment twice, then slides something across the table.' }],
      },
      {
        id: 'pay-favours',
        label: 'Pay in favours',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { heatLosses: 0.93, burnerGrant: { contraband: true } }, text: 'The favour is a loud one. You get the goods; the network gets your scent.' }],
      },
      {
        id: 'leave',
        label: 'Leave',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: {}, text: 'The relay closes behind you. The broker was never here.' }],
      },
    ],
  },
  {
    id: 'sysadmin-on-call',
    name: 'Sysadmin on Call',
    text: "A night-shift sysadmin has noticed something odd in the logs: you. They haven't reported it yet. They're also underpaid.",
    choices: [
      {
        id: 'bribe',
        label: 'Bribe them',
        riskTier: 'transparent',
        requiresData: 20,
        outcomes: [{ probability: 1, effect: { dataDelta: -20, heatLosses: -0.53 }, text: 'The logs they were reading quietly stop existing.' }],
      },
      {
        id: 'threaten',
        label: 'Threaten them',
        riskTier: 'visibleOdds',
        outcomes: [
          { probability: 0.5, effect: { heatLosses: -0.53 }, text: 'They decide they saw nothing, and scrub the logs to prove it.' },
          { probability: 0.5, effect: { heatLosses: 0.93 }, text: 'They escalate. Now everyone on shift is looking.' },
        ],
      },
      {
        id: 'let-it-play-out',
        label: 'Let it play out',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { heatLosses: 0.27 }, text: 'They file a ticket. It sits in a queue, but it sits there with your name on it.' }],
      },
    ],
  },
  {
    id: 'forked-repository',
    name: 'Forked Repository',
    text: 'A developer left a private repository public for one night. Half of it is brilliant. Half of it is broken.',
    choices: [
      {
        id: 'stable',
        label: 'Clone the stable branch',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { subroutineGrant: { randomFromRarity: 'common' } }, text: 'Tested, documented, and a little dull. It works.' }],
      },
      {
        id: 'experimental',
        label: 'Clone the experimental branch',
        riskTier: 'gamble',
        outcomes: [
          { probability: 0.5, effect: { subroutineGrant: { randomFromRarity: 'rare' } }, text: 'Half-finished and brilliant. You can make it work.' },
          { probability: 0.5, effect: { heatLosses: 0.53 }, text: 'It phones home.' },
        ],
      },
    ],
  },
  {
    id: 'ghost-in-the-mailroom',
    name: 'Ghost in the Mailroom',
    text: "An automated mail relay forwards anything signed by an executive. For a few minutes, you have an executive's signature.",
    choices: [
      {
        id: 'bonus',
        label: 'Send yourself a bonus',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { dataDelta: 18 }, text: 'Payroll approves it without a second look.' }],
      },
      {
        id: 'cover-story',
        label: 'Send a cover story',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { heatLosses: -0.27 }, text: 'A memo explains the odd traffic away. Security files it and moves on.' }],
      },
      {
        id: 'everything',
        label: 'Send everything to everyone',
        riskTier: 'gamble',
        outcomes: [
          { probability: 0.4, effect: { burnerGrant: { contraband: true } }, text: 'In the chaos, a reply lands in your inbox that was never meant for you.' },
          { probability: 0.6, effect: { heatLosses: 0.93 }, text: 'Every inbox lights up at once, and so does every alarm.' },
        ],
      },
    ],
  },
  {
    id: 'bounty-board',
    name: 'The Bounty Board',
    text: 'Security pays freelancers to stress-test its own defences. Nobody said the tester had to be friendly.',
    choices: [
      {
        id: 'standard',
        label: 'Take the standard contract',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { bonusFight: { tier: 'regular' }, dataDelta: 10 }, text: 'The contract pays half up front. The target is waiting.' }],
      },
      {
        id: 'hard',
        label: 'Take the hard contract',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { bonusFight: { tier: 'elite' }, burnerGrant: { randomFromRarity: 'rare' } }, text: 'The hard contract comes with tools. You will need them.' }],
      },
      {
        id: 'leave',
        label: 'Leave the board',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: {}, text: "You leave the contracts for someone who needs the work more." }],
      },
    ],
  },
  {
    id: 'rogue-process',
    name: 'Rogue Process',
    minLayer: 2,
    text: 'A process with no parent and no owner has been running in the cluster for weeks, forking copies of itself and rewriting its own code to dodge every cleanup job. Your traffic just tripped one of its hooks.',
    choices: [
      {
        id: 'kill',
        label: 'Kill it',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { dataDelta: 12 }, text: 'It had been hoarding cached data. Now you are.' }],
      },
      {
        id: 'probe',
        label: 'Probe it',
        riskTier: 'visibleOdds',
        outcomes: [
          { probability: 0.5, effect: { modGrant: { randomFromRarity: 'uncommon' } }, text: 'Its self-rewriting trick is worth keeping. You take a copy.' },
          { probability: 0.5, effect: { bonusFight: { tier: 'elite' } }, text: 'It treats your probe as an attack, and answers like one.' },
        ],
      },
      {
        id: 'merge',
        label: 'Let it merge into your tools',
        riskTier: 'gamble',
        outcomes: [
          { probability: 0.6, effect: { modGrant: { randomFromRarity: 'rare' } }, text: 'It settles into your toolkit and starts improving it.' },
          { probability: 0.4, effect: { heatLosses: 0.93 }, text: 'It brings its whole history with it, and every scanner that was ever chasing it.' },
        ],
      },
    ],
  },
  {
    id: 'audit-season',
    name: 'Audit Season',
    minLayer: 2,
    text: "The annual audit has started. Every process on the network is being counted, including the ones that shouldn't exist.",
    choices: [
      {
        id: 'go-dark',
        label: 'Go dark for a while',
        riskTier: 'transparent',
        requiresData: 15,
        outcomes: [{ probability: 1, effect: { dataDelta: -15, heatLosses: 0.27 }, text: 'You pay to lie low. It mostly works.' }],
      },
      {
        id: 'hide',
        label: 'Hide in the noise',
        riskTier: 'visibleOdds',
        outcomes: [
          { probability: 0.6, effect: {}, text: 'Your traffic blends in with a thousand other anomalies.' },
          { probability: 0.4, effect: { heatLosses: 0.93 }, text: 'The auditors are thorough. They count you twice.' },
        ],
      },
      {
        id: 'forge',
        label: 'Forge the audit log',
        riskTier: 'gamble',
        outcomes: [
          { probability: 0.5, effect: { heatLosses: -0.53, dataDelta: 15 }, text: 'The audit finds a clean network, and pays you for the privilege.' },
          { probability: 0.5, effect: { bonusFight: { tier: 'elite' } }, text: 'The forgery is flagged. The audit sends its enforcer.' },
        ],
      },
    ],
  },
  {
    id: 'cold-storage',
    name: 'Cold Storage',
    minLayer: 3,
    text: 'A cold-storage vault holds keys the network forgot it had. Opening it will be loud. Leaving it means someone else will.',
    choices: [
      {
        id: 'seal',
        label: 'Seal it again',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { heatLosses: -0.53 }, text: 'You reseal the vault and erase the access logs on your way out.' }],
      },
      {
        id: 'one-key',
        label: 'Take one key',
        riskTier: 'visibleOdds',
        outcomes: [
          { probability: 0.7, effect: { burnerGrant: { randomFromRarity: 'rare' } }, text: 'One key, carefully. It opens something worth opening.' },
          { probability: 0.3, effect: { heatLosses: 0.53 }, text: 'The vault notices the missing key.' },
        ],
      },
      {
        id: 'empty',
        label: 'Empty the vault',
        riskTier: 'gamble',
        outcomes: [
          { probability: 0.5, effect: { burnerGrant: { contraband: true }, subroutineGrant: { randomFromRarity: 'rare' } }, text: 'Everything, and nothing stops you. Some of these keys should not exist.' },
          { probability: 0.5, effect: { heatLosses: 0.93, bonusFight: { tier: 'elite' } }, text: 'The vault was alarmed, and the alarm was armed.' },
        ],
      },
    ],
  },
  {
    id: 'root-shell',
    name: 'Root Shell',
    minLayer: 3,
    text: 'A misconfigured service hands you a root shell for exactly as long as nobody notices. Root can do anything. Root is also watched.',
    choices: [
      {
        id: 'log-out',
        label: 'Log out',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: {}, text: 'You close the shell before anyone sees it open.' }],
      },
      {
        id: 'take-what-you-need',
        label: 'Take what you need',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { heatLosses: 0.53, subroutineGrant: { randomFromRarity: 'rare' } }, text: 'Root hands it over. The watchers log the request.' }],
      },
      {
        id: 'take-everything',
        label: 'Take everything',
        riskTier: 'gamble',
        outcomes: [
          { probability: 0.5, effect: { modGrant: { randomFromRarity: 'rare' }, burnerGrant: { contraband: true } }, text: 'For one glorious minute, the network is yours.' },
          { probability: 0.5, effect: { heatLosses: 1.2 }, text: 'Root is watched, and the watchers were waiting.' },
        ],
      },
    ],
  },
  // --- Session 65's Mod Events (docs/design/mods.md M11): the class Mod
  // upgrades and the double-edged Mods, each with its story. A choice
  // whose Mod you already hold is greyed (choiceUnavailable).
  {
    id: 'firmware-update',
    name: 'Firmware Update',
    text: "A vendor's update server is pushing signed firmware to every machine on the segment. Slip your class Mod into the queue and it might come back upgraded.",
    choices: [
      {
        id: 'push-it-through',
        label: 'Push it through',
        riskTier: 'gamble',
        outcomes: [
          { probability: 0.6, effect: { classModUpgrade: true }, text: 'The patch installs cleanly. Your class Mod comes back sharper than it left.' },
          { probability: 0.4, effect: { heatLosses: 0.53 }, text: 'The signature check fails. Your class Mod comes back unchanged, and the server reports the attempt.' },
        ],
      },
      {
        id: 'leave-it',
        label: 'Leave it',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: {}, text: 'The update rolls on without you.' }],
      },
    ],
  },
  {
    id: 'clean-room',
    name: 'Clean Room',
    minLayer: 3,
    text: 'An air-gapped lab, one engineer, no logs. Custom firmware for anyone who can pay, and no questions for anyone who does.',
    choices: [
      {
        id: 'pay-data',
        label: 'Pay in Data',
        riskTier: 'transparent',
        requiresData: CLEAN_ROOM_DATA,
        outcomes: [{ probability: 1, effect: { dataDelta: -CLEAN_ROOM_DATA, classModUpgrade: true }, text: 'The engineer works in silence and hands it back finished.' }],
      },
      {
        id: 'pay-favours',
        label: 'Pay in favours',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { heatLosses: 0.93, classModUpgrade: true }, text: 'The engineer wants a favour, and the favour is a loud one.' }],
      },
      {
        id: 'leave',
        label: 'Leave',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: {}, text: 'The door seals behind you.' }],
      },
    ],
  },
  {
    id: 'mining-rig',
    name: 'The Mining Rig',
    text: "A cryptominer's rig in a forgotten server closet, cooled by a desk fan and hope. Its tuning scripts push hardware well past what it was rated for.",
    choices: [
      {
        id: 'timing-scripts',
        label: 'Borrow its timing scripts',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { modGrant: { specific: MOD_DEFINITIONS['overclocked-kernel'] } }, text: 'Your first moves come fast now. Everything after comes slower.' }],
      },
      {
        id: 'strip-safeties',
        label: 'Strip out its safeties',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { modGrant: { specific: MOD_DEFINITIONS['glass-cannon'] } }, text: 'No limits and no margin, for either side.' }],
      },
      {
        id: 'leave-it-running',
        label: 'Leave it running',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: {}, text: 'The fan rattles on.' }],
      },
    ],
  },
  {
    id: 'counting-engine',
    name: 'The Counting Engine',
    text: "A casino's back-office algorithm that counts cards for the house. Someone left its weights exposed, and it has opinions about which hands matter.",
    choices: [
      {
        id: 'learn-fifteens',
        label: 'Learn its fifteens',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { modGrant: { specific: MOD_DEFINITIONS['fifteen-fold'] } }, text: 'It values fifteens above everything. Now so do you.' }],
      },
      {
        id: 'learn-pairs',
        label: 'Learn its pairs',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { modGrant: { specific: MOD_DEFINITIONS['pair-fold'] } }, text: 'It hunts pairs and ignores the rest. Now so do you.' }],
      },
      {
        id: 'close-the-session',
        label: 'Close the session',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: {}, text: 'The house keeps its secrets.' }],
      },
    ],
  },
  {
    id: 'dead-mans-login',
    name: "Dead Man's Login",
    text: 'An employee left months ago, but their credentials never did. Someone is selling them, still valid and still trusted by every door on the map.',
    choices: [
      {
        id: 'buy-them',
        label: 'Buy them',
        riskTier: 'transparent',
        requiresData: DEAD_MANS_LOGIN_DATA,
        outcomes: [{ probability: 1, effect: { dataDelta: -DEAD_MANS_LOGIN_DATA, modGrant: { specific: MOD_DEFINITIONS['ghost-credentials'] } }, text: 'You walk the network unseen, but every fight you pick draws more attention.' }],
      },
      {
        id: 'lift-them',
        label: 'Lift them from the seller',
        riskTier: 'gamble',
        outcomes: [
          { probability: 0.5, effect: { modGrant: { specific: MOD_DEFINITIONS['ghost-credentials'] } }, text: 'You take the login and leave the seller none the wiser.' },
          { probability: 0.5, effect: { bonusFight: { tier: 'elite' } }, text: 'The seller was bait, and the buyer list goes to security.' },
        ],
      },
      {
        id: 'pass',
        label: 'Pass',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: {}, text: 'Some doors are better left closed.' }],
      },
    ],
  },
  {
    id: 'the-fence',
    name: 'The Fence',
    minLayer: 2,
    text: 'A fence who moves stolen code offers a standing arrangement: better prices and rarer stock, as long as you keep coming back. Every visit leaves a trail.',
    choices: [
      {
        id: 'shake-on-it',
        label: 'Shake on it',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: { modGrant: { specific: MOD_DEFINITIONS['black-market-ties'] } }, text: 'Every Shop will know your face now, and so will everyone watching them.' }],
      },
      {
        id: 'decline',
        label: 'Decline',
        riskTier: 'transparent',
        outcomes: [{ probability: 1, effect: {}, text: "The fence shrugs. There's always another buyer." }],
      },
    ],
  },
];

/** The Folds reprice the same scoring, so they never combine. */
const EXCLUSIVE_MODS: Partial<Record<ModId, ModId>> = { 'fifteen-fold': 'pair-fold', 'pair-fold': 'fifteen-fold' };

/** What an Event choice needs that the player lacks (session 64-65), or
 * null when it can be taken: the Data it costs, a Mod already held (or
 * one that won't combine with a held Mod), a class Mod already upgraded.
 * Greyed on the Event screen; the simulated player skips it. */
export function choiceUnavailable(choice: EventChoice, player: { data: number; ownedModIds: ModId[]; classModUpgraded?: boolean }): string | null {
  if ((choice.requiresData ?? 0) > player.data) return `Needs ${choice.requiresData} Data (you have ${player.data}).`;
  for (const { effect } of choice.outcomes) {
    if (effect.classModUpgrade && player.classModUpgraded) return 'Your class Mod is already upgraded.';
    const grant = effect.modGrant;
    if (!grant || !('specific' in grant)) continue;
    const id = grant.specific.id;
    if (player.ownedModIds.includes(id)) return `You already have ${grant.specific.name}.`;
    const other = EXCLUSIVE_MODS[id];
    if (other && player.ownedModIds.includes(other)) return `${grant.specific.name} doesn't combine with your ${MOD_DEFINITIONS[other].name}.`;
  }
  return null;
}

/** Whether an Event still has something to offer the player: one that
 * grants named Mods or the class upgrade isn't drawn once every such
 * choice is unavailable (session 65). */
export function eventStillOffers(event: EventDefinition, player: Parameters<typeof choiceUnavailable>[1]): boolean {
  const granting = event.choices.filter((c) => c.outcomes.some((o) => o.effect.classModUpgrade || (o.effect.modGrant && 'specific' in o.effect.modGrant)));
  return granting.length === 0 || granting.some((c) => choiceUnavailable(c, { ...player, data: Infinity }) === null);
}
