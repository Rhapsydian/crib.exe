import type { SubroutineDefinition, SuitedArchetype } from './subroutine-types';
import { CLASS_STARTING_LOADOUTS } from './subroutines';

/**
 * Class type system (Phase 4 checkpoint A). All 6 classes ship
 * immediately selectable with no unlock gating -- session 21's
 * persistence-stub decision: a real save/profile layer is distinct,
 * unscoped infrastructure this project hasn't built yet, so the
 * designed unlock order (session 13) is recorded below for reference
 * only, not enforced anywhere.
 */
export type ClassId = 'breacher' | 'blackhat' | 'saboteur' | 'operator' | 'warden' | 'ghost';

/** The 6 bespoke starting passives (session 11) -- hand-coded hooks in
 * combat.ts/resolve.ts (Phase 4 checkpoint B), not a generic framework.
 * Referenced here as data so ClassDefinition can name which one a class
 * gets; the hook logic itself doesn't exist until checkpoint B. */
export type PassiveId = 'foothold' | 'zeroDay' | 'sleeperCell' | 'primed' | 'feedbackLoop' | 'returnToSender';

export interface ClassDefinition {
  id: ClassId;
  archetypes: [SuitedArchetype, SuitedArchetype];
  startingPassiveId: PassiveId;
  startingLoadout: SubroutineDefinition[];
}

export const CLASS_DEFINITIONS: Record<ClassId, ClassDefinition> = {
  breacher: {
    id: 'breacher',
    archetypes: ['exploit', 'encryption'],
    startingPassiveId: 'foothold',
    startingLoadout: CLASS_STARTING_LOADOUTS.breacher,
  },
  blackhat: {
    id: 'blackhat',
    archetypes: ['exploit', 'malware'],
    startingPassiveId: 'zeroDay',
    startingLoadout: CLASS_STARTING_LOADOUTS.blackhat,
  },
  saboteur: {
    id: 'saboteur',
    archetypes: ['malware', 'root'],
    startingPassiveId: 'sleeperCell',
    startingLoadout: CLASS_STARTING_LOADOUTS.saboteur,
  },
  operator: {
    id: 'operator',
    archetypes: ['exploit', 'root'],
    startingPassiveId: 'primed',
    startingLoadout: CLASS_STARTING_LOADOUTS.operator,
  },
  warden: {
    id: 'warden',
    archetypes: ['malware', 'encryption'],
    startingPassiveId: 'feedbackLoop',
    startingLoadout: CLASS_STARTING_LOADOUTS.warden,
  },
  ghost: {
    id: 'ghost',
    archetypes: ['encryption', 'root'],
    startingPassiveId: 'returnToSender',
    startingLoadout: CLASS_STARTING_LOADOUTS.ghost,
  },
};

/** Session 13's designed unlock order -- recorded for reference/future
 * gating (a real save/profile layer), not enforced by anything today.
 * All 6 classes are selectable right now regardless of this order. */
export const CLASS_UNLOCK_ORDER: ClassId[] = ['breacher', 'blackhat', 'warden', 'saboteur', 'operator', 'ghost'];

export const DEFAULT_CLASS_ID: ClassId = 'breacher';
