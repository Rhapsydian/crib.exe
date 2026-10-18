/**
 * A scrolling log that follows its newest line (the user's ask): as lines
 * arrive it scrolls to the bottom -- unless you've scrolled up to read,
 * when it leaves you be until you scroll back down. A Svelte action for
 * the scrolling container: `<aside use:stickToBottom>`.
 */
export function stickToBottom(node: HTMLElement) {
  // Within this many pixels of the bottom counts as "at the bottom".
  const SLACK = 40;
  let stick = true;
  const toBottom = () => {
    node.scrollTop = node.scrollHeight;
  };
  const onScroll = () => {
    stick = node.scrollHeight - node.scrollTop - node.clientHeight < SLACK;
  };
  const observer = new MutationObserver(() => {
    if (stick) toBottom();
  });
  observer.observe(node, { childList: true, subtree: true, characterData: true });
  node.addEventListener('scroll', onScroll, { passive: true });
  toBottom();
  return {
    destroy() {
      observer.disconnect();
      node.removeEventListener('scroll', onScroll);
    },
  };
}
