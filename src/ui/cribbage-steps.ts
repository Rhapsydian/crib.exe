import type { CribbageBeat } from '../engine/basic-cribbage';
import type { Card } from '../engine/cards';
import { WIN_SCORE } from '../engine/basic-cribbage';
import type { CombatBeat } from '../engine/combat';
import type { PlayerIndex } from '../engine/game';
import type { GaugeReading } from '../engine/resolve';
import type { Step } from './timeline';
import { occurrenceFromHisHeels, occurrencesFromHandEvents, occurrencesFromPeggingEvent, type ScoringOccurrence } from '../engine/triggers';

/**
 * Vanilla Cribbage on the fight screen's machinery (milestone 4
 * checkpoint 3). A Cribbage game's timeline is translated into the fight
 * timeline's beats, so the replay stepper, the table, the show panel,
 * the score callouts and the log lines all work unchanged. A score is a
 * gauge filling to 121 (V7: the minimal bars), so each points beat
 * carries both scores as the "win gauge" readings the replay animates.
 */

/** Both scores as gauge readings (win gauge = score, threshold 121). */
export function scoreReadings(scores: readonly [number, number]): [GaugeReading, GaugeReading] {
  const read = (score: number): GaugeReading => ({ win: score, winThreshold: WIN_SCORE, initiative: 0, initiativeThreshold: 1, ward: 0, heat: 0 });
  return [read(scores[0]), read(scores[1])];
}

/** The fight-timeline beats for a Cribbage game so far. */
export function cribbageBeats(timeline: readonly CribbageBeat[]): CombatBeat[] {
  const out: CombatBeat[] = [];
  let scores: [number, number] = [0, 0];
  const points = (phase: 'cut' | 'peg' | 'show', occurrence: ScoringOccurrence, cards?: Card[]) => {
    const p: PlayerIndex = occurrence.player;
    scores = p === 0 ? [Math.min(WIN_SCORE, scores[0] + occurrence.magnitude), scores[1]] : [scores[0], Math.min(WIN_SCORE, scores[1] + occurrence.magnitude)];
    out.push({ kind: 'points', phase, occurrence, gauges: scoreReadings(scores), ...(cards ? { cards } : {}), firesBefore: 0 });
  };
  for (const beat of timeline) {
    switch (beat.kind) {
      case 'hand':
        out.push({ kind: 'hand', handIndex: beat.handIndex, dealer: beat.dealer, firesBefore: 0 });
        break;
      case 'cut': {
        out.push({ kind: 'cut', starter: beat.starter, dealer: beat.dealer, firesBefore: 0 });
        const heels = occurrenceFromHisHeels(beat.heels, beat.dealer);
        if (heels) points('cut', heels);
        break;
      }
      case 'peg':
        out.push({ kind: 'peg', event: beat.event, firesBefore: 0 });
        for (const o of occurrencesFromPeggingEvent(beat.event)) points('peg', o);
        break;
      case 'show': {
        out.push({ kind: 'show', owner: beat.owner, player: beat.player, cards: beat.cards, starter: beat.starter, total: beat.total, firesBefore: 0 });
        const occurrences = occurrencesFromHandEvents(beat.events, beat.player);
        occurrences.forEach((o, k) => points('show', o, beat.events[k].cards));
        break;
      }
    }
    // The engine caps the winner at 121; keep the readings in step with it.
    scores = [beat.scores[0], beat.scores[1]];
  }
  return out;
}

/** Each player's two pegs after the steps shown so far: [front, back] --
 * the back peg is where the front stood before the last score, so the
 * gap is always the last score (V6/V7). */
export function pegsAfter(steps: readonly Step[], shown: number): [[number, number], [number, number]] {
  const pegs: [[number, number], [number, number]] = [
    [0, 0],
    [0, 0],
  ];
  for (let i = 0; i < Math.min(shown, steps.length); i++) {
    const s = steps[i];
    if (s.type !== 'beat' || s.beat.kind !== 'points') continue;
    const p = s.beat.occurrence.player;
    pegs[p] = [s.beat.gauges[p].win, pegs[p][0]];
  }
  return pegs;
}
