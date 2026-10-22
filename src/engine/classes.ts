import type { Archetype, SubroutineDefinition } from './subroutine-types';
import { CLASS_STARTING_LOADOUTS } from './subroutines';
import type { ModId } from './mod-types';

/**
 * Class type system. Session 51 (A8) rebuilt the six classes as one per
 * pair of the four new archetypes, each with a **bridge** passive that
 * makes one of its archetypes feed the other.
 *
 * Step 3 (docs/archive/authoring-design.md C1-C4) named them -- Blackhat,
 * Operator, Eidolon, Breacher, Warden, Wraith -- and gave each a bespoke
 * bridge (rules in resolve.ts's applyBridgeOn* hooks, Mods in mods.ts).
 * Ids stay pair-based; `name` is display data. Starting loadouts are the
 * authored ones (content/starting-loadouts.ts).
 *
 * All 6 ship immediately selectable with no unlock gating -- session
 * 21's persistence-stub decision still holds: there is no save/profile
 * layer to gate against.
 */
export type ClassId =
  | 'exploit-overclock'
  | 'exploit-daemon'
  | 'daemon-overclock'
  | 'exploit-honeypot'
  | 'daemon-honeypot'
  | 'overclock-honeypot';

/** Class passives are class-exclusive Mods (Phase 5 Mods checkpoint D) --
 * granted automatically at run start by class selection, never appearing
 * in the general reward/Shop pool. `startingPassiveId` names *which* ModId
 * a class gets; the definition and hook logic live in mods.ts/resolve.ts. */
export interface ClassDefinition {
  id: ClassId;
  /** Display name (step 3, C4). */
  name: string;
  archetypes: [Archetype, Archetype];
  startingPassiveId: ModId;
  startingLoadout: SubroutineDefinition[];
}

export const CLASS_DEFINITIONS: Record<ClassId, ClassDefinition> = {
  'exploit-overclock': {
    id: 'exploit-overclock',
    name: 'Blackhat',
    archetypes: ['exploit', 'overclock'],
    startingPassiveId: 'bridge-exploit-overclock',
    startingLoadout: CLASS_STARTING_LOADOUTS['exploit-overclock'],
  },
  'exploit-daemon': {
    id: 'exploit-daemon',
    name: 'Operator',
    archetypes: ['exploit', 'daemon'],
    startingPassiveId: 'bridge-exploit-daemon',
    startingLoadout: CLASS_STARTING_LOADOUTS['exploit-daemon'],
  },
  'daemon-overclock': {
    id: 'daemon-overclock',
    name: 'Eidolon',
    archetypes: ['daemon', 'overclock'],
    startingPassiveId: 'bridge-daemon-overclock',
    startingLoadout: CLASS_STARTING_LOADOUTS['daemon-overclock'],
  },
  'exploit-honeypot': {
    id: 'exploit-honeypot',
    name: 'Breacher',
    archetypes: ['exploit', 'honeypot'],
    startingPassiveId: 'bridge-exploit-honeypot',
    startingLoadout: CLASS_STARTING_LOADOUTS['exploit-honeypot'],
  },
  'daemon-honeypot': {
    id: 'daemon-honeypot',
    name: 'Warden',
    archetypes: ['daemon', 'honeypot'],
    startingPassiveId: 'bridge-daemon-honeypot',
    startingLoadout: CLASS_STARTING_LOADOUTS['daemon-honeypot'],
  },
  'overclock-honeypot': {
    id: 'overclock-honeypot',
    name: 'Wraith',
    archetypes: ['overclock', 'honeypot'],
    startingPassiveId: 'bridge-overclock-honeypot',
    startingLoadout: CLASS_STARTING_LOADOUTS['overclock-honeypot'],
  },
};

/** Provisional unlock direction (A8): Exploit + Overclock first (fast
 * spikes, simplest to read), Honeypot pairs late (A2's watch item: the
 * highest-skill-floor archetype). Recorded for future gating only --
 * nothing enforces it. */
export const CLASS_UNLOCK_ORDER: ClassId[] = [
  'exploit-overclock',
  'exploit-daemon',
  'daemon-overclock',
  'exploit-honeypot',
  'daemon-honeypot',
  'overclock-honeypot',
];

export const ALL_CLASS_IDS: ClassId[] = CLASS_UNLOCK_ORDER;

export const DEFAULT_CLASS_ID: ClassId = 'exploit-overclock';
