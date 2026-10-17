/**
 * Hover tips (playable-design P6): on a screen with a mouse, hovering a
 * piece, a Mod, a Burner or a gauge shows a quick tip; a click still
 * opens the full detail panel. Phones never see these -- they tap.
 *
 * `use:tip={text}` on any element. One shared tip element follows
 * whatever is hovered.
 */
let el: HTMLDivElement | null = null;

const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

function tipElement(): HTMLDivElement {
  if (el) return el;
  el = document.createElement('div');
  el.className = 'hover-tip';
  el.setAttribute('role', 'tooltip');
  document.body.appendChild(el);
  return el;
}

function show(target: HTMLElement, text: string) {
  if (!text || !canHover()) return;
  const t = tipElement();
  t.textContent = text;
  t.style.display = 'block';
  const r = target.getBoundingClientRect();
  const w = t.offsetWidth;
  const h = t.offsetHeight;
  const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
  // Above the element, or below it when there's no room.
  const top = r.top - h - 6 >= 8 ? r.top - h - 6 : r.bottom + 6;
  t.style.left = `${left}px`;
  t.style.top = `${top}px`;
}

function hide() {
  if (el) el.style.display = 'none';
}

export function tip(node: HTMLElement, text: string | null | undefined) {
  let current = text ?? '';
  const enter = () => show(node, current);
  node.addEventListener('mouseenter', enter);
  node.addEventListener('mouseleave', hide);
  node.addEventListener('mousedown', hide);
  return {
    update(next: string | null | undefined) {
      current = next ?? '';
    },
    destroy() {
      node.removeEventListener('mouseenter', enter);
      node.removeEventListener('mouseleave', hide);
      node.removeEventListener('mousedown', hide);
      hide();
    },
  };
}
