/**
 * Per-turn beta charge distributions -- GENERATED from step 2's checkpoint 4
 * measurement (`docs/calibration/step2-cp4-freq-*.jsonl`, `scripts/beta-frequency.ts`):
 * skill 0.85, 400 seeds x 2 seats, Credit-2 host mirror; Ward-dependent rows from
 * the run where the probe side carries Ward 2. Each entry maps a charge count to
 * how many owner-turns banked exactly that many. Do not hand-edit; re-measure.
 */
export const BETA_FREQUENCY: Readonly<Record<string, Readonly<Record<number, number>>>> = {
  'cards:fifteen': { 0: 1069, 1: 1775, 2: 3210, 3: 3141, 4: 2127, 5: 544, 6: 60 },
  'cards:pair': { 0: 2421, 1: 5436, 2: 3031, 3: 867, 4: 153, 5: 18 },
  'cards:run': { 0: 5761, 1: 5199, 2: 910, 3: 55, 4: 1 },
  'cards:flush': { 0: 11263, 1: 659, 2: 4 },
  'cards:hisNobs': { 0: 10793, 1: 1122, 2: 11 },
  'cards:thirtyOne': { 0: 10111, 1: 1759, 2: 56 },
  'cards:go': { 0: 4334, 1: 5357, 2: 2025, 3: 196, 4: 14 },
  'cards:pair>=6 (royal)': { 0: 10611, 1: 1295, 2: 20 },
  'cards:run>=4': { 0: 8555, 1: 3222, 2: 149 },
  'cards:suit (own)': { 0: 5168, 1: 3749, 2: 2148, 3: 551, 4: 267, 5: 31, 6: 10, 7: 1, 8: 1 },
  'cards:fifteen (opponent)': { 0: 4576, 1: 1219, 2: 1230, 3: 1145, 4: 1128, 5: 892, 6: 689, 7: 502, 8: 278, 9: 158, 10: 69, 11: 29, 12: 3, 13: 6, 14: 1, 15: 1 },
  'cards:pair (opponent)': { 0: 4590, 1: 3055, 2: 2217, 3: 1316, 4: 564, 5: 155, 6: 24, 7: 4, 8: 1 },
  'cards:run (opponent)': { 0: 6926, 1: 3342, 2: 1283, 3: 327, 4: 39, 5: 8, 6: 1 },
  'cards:flush (opponent)': { 0: 11288, 1: 621, 2: 17 },
  'cards:hisNobs (opponent)': { 0: 10808, 1: 1084, 2: 34 },
  'cards:thirtyOne (opponent)': { 0: 10134, 1: 1721, 2: 67, 3: 4 },
  'cards:go (opponent)': { 0: 4622, 1: 5009, 2: 1983, 3: 280, 4: 32 },
  'progress:points': { 1: 6, 2: 20, 3: 8, 4: 21, 5: 29, 6: 51, 7: 158, 8: 261, 9: 369, 10: 464, 11: 2096, 12: 4503, 13: 2385, 14: 581, 15: 345, 16: 314, 17: 174, 18: 51, 19: 30, 20: 24, 21: 15, 22: 15, 23: 6 },
  'progress:fires': { 0: 800, 1: 11126 },
  'progress:absorbed': { 0: 5144, 2: 4468, 4: 2299, 6: 320, 8: 9 },
  'state:dealer': { 0: 4549, 1: 7377 },
  'state:nonDealer': { 0: 7377, 1: 4549 },
  'state:wardAbove 2': { 0: 4398, 1: 7842 },
  'state:wardAbove 4': { 0: 8515, 1: 3725 },
  'state:wardAbove 8': { 0: 11807, 1: 433 },
  'state:ownGauge>0.5': { 0: 8794, 1: 3132 },
  'state:ownGauge<0.25': { 0: 7126, 1: 4800 },
  'state:oppGauge>0.5': { 0: 9064, 1: 2862 },
  'state:oppGauge<0.25': { 0: 6661, 1: 5265 },
};
