import { DAILY_MODS, type DailyCategory, type DailyMod } from '../engine/daily';
import { BURNER_DEFINITIONS } from '../engine/burners';
import { ALL_SUBROUTINES } from '../engine/subroutines';
import { archetypeInfo } from './suits';
import { starText, type Stars } from '../engine/skill';

/**
 * A day's Mods in words (session 72, docs/design/daily-runs.md DR9): the
 * name, and what it rolled for the day (Go Bag's Burners, Field Kit's
 * subroutine, Suit Surge's suit), so the briefing names it all.
 */
export const CATEGORY_NAME: Record<DailyCategory, string> = { directive: 'DIRECTIVE', glitch: 'GLITCH', advisory: 'ADVISORY', bulletin: 'BULLETIN' };

/** "Go Bag (Flash Drive, Log Wiper)", "Suit Surge (Overclock)". */
export function dailyModName(mod: DailyMod): string {
  const name = DAILY_MODS[mod.id].name;
  const items = mod.burners
    ? mod.burners.map((id) => BURNER_DEFINITIONS[id].name)
    : mod.subroutine
      ? [ALL_SUBROUTINES.find((p) => p.id === mod.subroutine)?.name ?? mod.subroutine]
      : mod.suit
        ? [archetypeInfo(mod.suit).name]
        : [];
  return items.length ? `${name} (${items.join(', ')})` : name;
}

/** The Mod's rules, with its rolled items spelled out. */
export function dailyModText(mod: DailyMod): string {
  const text = DAILY_MODS[mod.id].text;
  if (mod.burners) return `Start with ${mod.burners.map((id) => BURNER_DEFINITIONS[id].name).join(' and ')}.`;
  if (mod.subroutine) return `${ALL_SUBROUTINES.find((p) => p.id === mod.subroutine)?.name ?? mod.subroutine} joins your starters.`;
  if (mod.suit) return `Each ${archetypeInfo(mod.suit).name} card you play while pegging adds 1 initiative.`;
  return text;
}

/** The share line (DR9): "crib.exe daily 2026-10-26 · 3,410 · L3 · Breacher · Cribbage ★★★★☆". */
export function shareLine(date: string, score: number, layers: number, className: string, stars: Stars | null, practice: boolean): string {
  return [`crib.exe daily ${date}${practice ? ' (practice)' : ''}`, score.toLocaleString('en-US'), `L${layers}`, className, ...(stars !== null ? [`Cribbage ${starText(stars)}`] : [])].join(' · ');
}
