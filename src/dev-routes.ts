/** The developer pages, by address (session 72, go-live step 1: kept for
 * development, out of the release build). #test is milestone 2's
 * single-fight harness; the rest are the design mockups -- #mock (the
 * chosen fight screen), the three P3 fight mockups at #tabs / #drawers /
 * #compact, #map and #pegboard -- with a switcher. A file of its own so
 * App can read the list without importing DevRoutes.svelte, which it
 * loads only in development. */
export const MOCKS = ['mock', 'tabs', 'drawers', 'compact', 'map', 'pegboard'] as const;
export const DEV_ROUTES = ['test', ...MOCKS] as const;
export type DevRoute = (typeof DEV_ROUTES)[number];
