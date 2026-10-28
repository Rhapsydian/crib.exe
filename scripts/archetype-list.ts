/**
 * Archetype list (session 66, docs/design/subroutines.md): every pool
 * subroutine of one archetype, with its rarity and its card text, one per
 * line. A quick read of an archetype's content while authoring or
 * reviewing it.
 *
 * Usage:
 *   npx tsx scripts/archetype-list.ts exploit|daemon|overclock|honeypot
 */
import { ALL_POOL_SUBROUTINES } from '../src/engine/subroutines';
import { rarityOf } from '../src/engine/rewards';
import { pieceLines } from '../src/ui/reward-text';

const archetype = process.argv[2];
const subroutines = ALL_POOL_SUBROUTINES.filter((s) => s.archetype === archetype);
if (subroutines.length === 0) {
  console.error('Usage: npx tsx scripts/archetype-list.ts exploit|daemon|overclock|honeypot');
  process.exit(1);
}
for (const s of subroutines) console.log(`${s.name} (${rarityOf(s.id)}): ${pieceLines(s).join(' | ')}`);
