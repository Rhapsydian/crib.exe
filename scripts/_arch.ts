import { ALL_POOL_SUBROUTINES } from '../src/engine/subroutines';
import { rarityOf } from '../src/engine/rewards';
import { pieceLines } from '../src/ui/reward-text';
const a = process.argv[2];
for (const p of ALL_POOL_SUBROUTINES.filter((q) => q.archetype === a)) console.log(`${p.name} (${rarityOf(p.id)}): ${pieceLines(p).join(' | ')}`);
