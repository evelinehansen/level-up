// seed.js - sample data shown only while localStorage is empty, so a
// first-time viewer immediately gets the concept. It lives in memory only,
// is never persisted, and clears the moment the first real win is logged.

import { toISODate, addDays } from './engine.js';

// [daysAgo, conditions, category, note]
const SAMPLE = [
  [0, ['Rain', 'Tiredness'], 'Running', 'Sideways rain. Went anyway.'],
  [1, ['Early morning'], 'Running', null],
  [1, ['Busy schedule'], 'Work', 'Wrote the report before checking email.'],
  [3, ['Temptations'], 'Home', 'Cooked instead of ordering in.'],
  [4, ['Rain', 'Wind'], 'Running', null],
  [6, ['Resistance'], 'Work', 'Started the task I had dodged for a week.'],
  [8, ['Tiredness', 'Late night'], null, null],
  [9, ['Hot weather'], 'Running', null],
  [12, ['Bugs'], 'Work', 'Stayed with the flaky test until it confessed.'],
  [13, ['Early morning', 'Darkness'], 'Running', null],
  [15, ['Busy schedule'], 'Home', null],
  [17, ['Resistance', 'Tiredness'], 'Work', null],
  [20, ['Rain'], 'Running', null],
  [22, ['Temptations'], null, 'Left the phone in the other room.'],
  [25, ['Pain'], 'Running', 'Sore calves, short loop, still counts.'],
  [27, ['Early morning'], 'Running', null],
  [31, ['Wind', 'Cold weather'], 'Running', null],
  [34, ['Resistance'], 'Home', 'Finally sorted the paper pile.'],
  [38, ['Busy schedule', 'Tiredness'], 'Work', null],
  [43, ['Darkness', 'Cold weather'], 'Running', null],
  [47, ['Late night'], 'Work', null],
  [52, ['Rain', 'Tiredness'], 'Running', null],
  [58, ['Temptations'], 'Home', null],
  [63, ['Early morning'], 'Running', null],
  [70, ['Snow', 'Cold weather'], 'Running', 'First snow of the season.'],
  [78, ['Icy roads', 'Darkness'], 'Running', null],
  [85, ['Resistance'], 'Work', null],
  [96, ['Snow', 'Wind'], 'Running', null],
  [110, ['Icy roads', 'Early morning'], 'Running', null],
  [128, ['Cold weather', 'Darkness'], 'Running', null],
  [150, ['Tiredness'], 'Home', null],
  [175, ['Rain'], 'Running', null],
];

export function makeSeedEntries(today = new Date()) {
  return SAMPLE.map(([daysAgo, conditions, category, note], i) => ({
    id: `seed-${i + 1}`,
    dateISO: toISODate(addDays(today, -daysAgo)),
    conditions,
    category,
    note,
  }));
}
