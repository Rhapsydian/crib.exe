/**
 * Dumps every player-facing rules text -- subroutines (Process / Hook, as
 * the detail panel shows them), general Mods, Burners -- for a wording
 * review (session 60's text audit). Prints Markdown.
 *
 * Usage: npx tsx scripts/text-dump.ts > out.md
 */
import { ALL_POOL_SUBROUTINES } from '../src/engine/subroutines';
import { rarityOf } from '../src/engine/rewards';
import { describeHook, describeProcess, forEnemy } from '../src/ui/describe';
import { MOD_TEXT } from '../src/ui/kit';
import { MOD_DEFINITIONS } from '../src/engine/mods';
import { BURNER_DEFINITIONS } from '../src/engine/burners';
import { burnerText } from '../src/ui/reward-text';
import { AUTHORED_GATEKEEPERS } from '../src/engine/content/enemies';
import { ENEMY_SUBROUTINES } from '../src/engine/content/enemy-subroutines';

console.log('## Subroutines (player pool)\n');
for (const p of ALL_POOL_SUBROUTINES) {
  console.log(`- **${p.name}** (${p.archetype}, ${rarityOf(p.id)}) — Process: ${describeProcess(p.alpha)}${p.beta ? ` · Hook: ${describeHook(p)}` : ''}`);
}
console.log('\n## Gatekeeper subroutines (enemy-only, in the enemy voice)\n');
const seen = new Set(ALL_POOL_SUBROUTINES.map((p) => p.id));
for (const g of AUTHORED_GATEKEEPERS) for (const p of g.loadout) {
  if (seen.has(p.id)) continue;
  seen.add(p.id);
  console.log(`- **${p.name}** (${p.archetype}) — Process: ${forEnemy(describeProcess(p.alpha))}${p.beta ? ` · Hook: ${forEnemy(describeHook(p))}` : ''}`);
}
console.log('\n## Enemy-only subroutines (in the enemy voice)\n');
for (const p of ENEMY_SUBROUTINES) {
  console.log(`- **${p.name}** (${p.archetype}) — Process: ${forEnemy(describeProcess(p.alpha))}${p.beta ? ` · Hook: ${forEnemy(describeHook(p))}` : ''}`);
}
console.log('\n## General Mods\n');
for (const [id, text] of Object.entries(MOD_TEXT)) console.log(`- **${MOD_DEFINITIONS[id as keyof typeof MOD_DEFINITIONS].name}** (${MOD_DEFINITIONS[id as keyof typeof MOD_DEFINITIONS].rarity}) — ${text}`);
console.log('\n## Burners\n');
for (const b of Object.values(BURNER_DEFINITIONS)) console.log(`- **${b.name}** (${b.rarity}, ${b.contexts.join('/')}) — ${burnerText(b)}`);
