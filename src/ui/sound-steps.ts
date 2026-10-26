import { sound, type SoundId } from './sound';
import { stepGauges, type Step } from './timeline';

/**
 * A replay step's sound (go-live step 4): fights and Play Cribbage play out
 * as the same steps, so one table serves both. Pegging points and show
 * counts tick; whose card it was rises or falls; a turn, a Mod, a Burner
 * and a daily effect each have theirs. A step with nothing to say is silent.
 */
export function stepSound(step: Step): SoundId | null {
  if (step.type === 'clear') return 'clear';
  if (step.type === 'fire') return 'fire';
  const b = step.beat;
  switch (b.kind) {
    case 'hand':
      return 'handStart';
    case 'cut':
      return 'cut';
    case 'peg':
      return b.event.type === 'play' ? (b.event.player === 0 ? 'cardYou' : 'cardThem') : null;
    case 'points':
      return b.phase === 'show' ? 'show' : 'peg';
    case 'turn':
      return b.side === 0 ? 'turnYou' : 'turnThem';
    case 'mod':
    case 'burner':
    case 'daily':
      return 'mod';
    case 'strain':
      return 'alarm';
    default:
      return null;
  }
}

/** Follows a replay as it steps: each step one at a time gets its sound,
 * and Heat raised against the player (an alarm) its warning. A jump of
 * several steps at once (a skip, a resume) is silent. */
export function stepSounder(): (steps: readonly Step[], shown: number) => void {
  let seen = -1;
  let heat: number | null = null;
  return (steps, shown) => {
    const step = shown > 0 ? steps[shown - 1] : undefined;
    const reading = step ? stepGauges(step) : null;
    if (shown === seen + 1 && step) {
      const id = stepSound(step);
      if (id) sound.play(id);
      if (reading && heat !== null && reading[0].heat > heat && step.type === 'fire') sound.play('alarm');
    }
    if (reading) heat = reading[0].heat;
    seen = shown;
  };
}
