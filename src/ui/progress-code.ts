import { migrate, type Profile } from './profile.svelte';

/**
 * Progress as a copy-and-paste code (go-live step 3; docs/meta-progression-
 * design.md MP12): the profile and lesson progress, not saved games or
 * preferences. `CRIBEXE1-` + the payload's JSON, deflated and base64url'd,
 * + `-` + a checksum of that, so a typo or an edit is caught. An older
 * code's profile is brought forward by the profile's own migration.
 */
export const CODE_PREFIX = 'CRIBEXE1-';

export interface ProgressPayload {
  profile: Profile;
  lessons: string[];
}

/** FNV-1a, 32 bits, as 8 hex digits. */
function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

const toBase64Url = (bytes: Uint8Array) => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64Url = (text: string) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export async function encodeProgress(payload: ProgressPayload): Promise<string> {
  const deflated = await pipe(new TextEncoder().encode(JSON.stringify(payload)), new CompressionStream('deflate-raw'));
  const body = toBase64Url(deflated);
  return `${CODE_PREFIX}${body}-${checksum(body)}`;
}

/** The payload a code holds, or why it can't be read. */
export async function decodeProgress(code: string): Promise<ProgressPayload | { error: string }> {
  const text = code.replace(/\s+/g, '');
  if (!text.startsWith(CODE_PREFIX)) return { error: "That isn't a crib.exe progress code." };
  const rest = text.slice(CODE_PREFIX.length);
  const dash = rest.lastIndexOf('-');
  const body = rest.slice(0, dash);
  if (dash < 0 || checksum(body) !== rest.slice(dash + 1)) return { error: 'That code is incomplete or has a typo. Copy it again in full.' };
  try {
    const raw = JSON.parse(new TextDecoder().decode(await pipe(fromBase64Url(body), new DecompressionStream('deflate-raw')))) as Partial<ProgressPayload>;
    if (!raw.profile || typeof raw.profile !== 'object') return { error: "That code doesn't hold any progress." };
    return { profile: migrate(raw.profile), lessons: Array.isArray(raw.lessons) ? raw.lessons.filter((l) => typeof l === 'string') : [] };
  } catch {
    return { error: 'That code is damaged and couldn’t be read.' };
  }
}

/** What a code holds, in a line: "Rep 340 · 4 classes · 12 runs · 3 Daily Runs". */
export function progressSummary(p: ProgressPayload): string {
  const dailies = Object.values(p.profile.daily).filter((d) => d.scored !== undefined).length;
  const parts = [
    `Rep ${p.profile.rep}`,
    `${p.profile.classes.length} class${p.profile.classes.length === 1 ? '' : 'es'}`,
    `${p.profile.runsFinished} run${p.profile.runsFinished === 1 ? '' : 's'} finished`,
    `${p.profile.victories} victor${p.profile.victories === 1 ? 'y' : 'ies'}`,
    `${dailies} Daily Run${dailies === 1 ? '' : 's'}`,
    `${p.lessons.length} lesson${p.lessons.length === 1 ? '' : 's'}`,
  ];
  if (p.profile.securityOpen) parts.splice(4, 0, `Security Level ${p.profile.securityOpen} open`);
  return parts.join(' · ');
}
