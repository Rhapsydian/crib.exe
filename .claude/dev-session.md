# Project-specific process override

Design/decision sessions for this project (any session that produces or
revises `DESIGN.md`) must resolve open design questions live, one at a
time — state the question, give a concrete recommendation with reasoning,
wait for the user's actual answer — rather than batching several
decisions into one round or silently picking defaults in an autonomous
drafting pass. Use the `/decision-session` skill.

This mirrors the convention established in the sibling `glyphrogue` and
`glyphkeep` projects (see their own `.claude/dev-session.md` overrides).
Scoped to design-doc sessions specifically, not implementation sessions.

## Push workflow

Push only when the user asks. A push is one action with three parts:

1. `git push origin playable` (deploys cribexe.com through GitHub Pages)
2. `git push origin playable:master` (keeps `master` equal)
3. **itch.io**, when the push changes the game (anything outside docs and
   Markdown: `src/`, `public/`, `index.html`, package or build config):

   ```
   npm run build
   C:\Users\husbando\tools\butler\butler.exe push dist rhapsydian/cribexe:html5 --userversion 0.9.1
   ```

   `--userversion` is the current release (`package.json`); butler is
   already logged in. Check `butler status rhapsydian/cribexe:html5` until
   the new build has a tick. A docs-only push skips this step, and the
   report says so.

Then confirm each deploy before calling it live: cribexe.com's bundle
(`assets/index-*.js`) carries the new text; itch.io's build shows as
current in `butler status` (itch serves the game through a signed link
that can't be fetched directly).

**Why:** itch.io builds go up by hand, so they fell behind cribexe.com
unnoticed in session 75, while a Reddit post was sending players to itch.
