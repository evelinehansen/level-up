// engine.js - pure functions only, no DOM.
// All derivation logic lives here: counts, filters, heatmap buckets,
// treemap layout, import validation. Derived values are computed, never stored.

export const CONDITIONS = [
  'Rain', 'Snow', 'Darkness', 'Hot weather', 'Cold weather', 'Wind',
  'Icy roads', 'Tiredness', 'Early morning', 'Late night', 'Busy schedule',
  'Temptations', 'Resistance', 'Pain', 'Bugs', 'Other',
];

// The treemap and condition table only render at or above this many entries
// (no fake precision below an honest minimum).
export const MIN_FOR_BREAKDOWN = 5;

// ---------- dates ----------

// Local date as YYYY-MM-DD (not UTC, so late-evening wins land on the right day).
export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---------- filtering and ordering ----------

export function filterByCategory(entries, category) {
  if (category === null) return entries;
  return entries.filter((e) => e.category === category);
}

// Unique categories present in the data, alphabetical.
export function categoriesOf(entries) {
  const seen = new Set();
  for (const e of entries) {
    if (e.category) seen.add(e.category);
  }
  return [...seen].sort((a, b) => a.localeCompare(b, 'nb-NO'));
}

// Newest first. Dates only have day resolution, so within a day the
// most recently added entry comes first.
export function sortNewestFirst(entries) {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      if (a.entry.dateISO !== b.entry.dateISO) {
        return a.entry.dateISO < b.entry.dateISO ? 1 : -1;
      }
      return b.index - a.index;
    })
    .map((x) => x.entry);
}

// ---------- heatmap ----------

// A day's heat is the number of conditions defeated, so an entry that beat
// two conditions weighs twice as much as one that beat a single condition.
export function perDayCounts(entries) {
  const counts = {};
  for (const e of entries) {
    counts[e.dateISO] = (counts[e.dateISO] || 0) + e.conditions.length;
  }
  return counts;
}

// 0 conditions -> level 0, then increasing sage intensity. Density, never streaks.
export function heatLevel(count) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

// Trailing 53 weeks ending with the current week, Monday-first (nb-NO).
// Returns an array of week columns, each an array of 7 day cells.
export function heatmapModel(entries, today = new Date()) {
  const counts = perDayCounts(entries);
  const end = startOfDay(today);
  const dow = (end.getDay() + 6) % 7; // 0 = Monday
  const currentMonday = addDays(end, -dow);
  const start = addDays(currentMonday, -52 * 7);
  const weeks = [];
  for (let w = 0; w < 53; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      const iso = toISODate(date);
      const count = counts[iso] || 0;
      days.push({
        iso,
        date,
        count,
        level: heatLevel(count),
        future: date > end,
      });
    }
    weeks.push(days);
  }
  return weeks;
}

// ---------- condition distribution ----------

// Only conditions actually defeated, sorted by count descending
// (ties alphabetical so the order is stable).
export function conditionCounts(entries) {
  const counts = new Map();
  for (const e of entries) {
    for (const c of e.conditions) {
      counts.set(c, (counts.get(c) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([condition, count]) => ({ condition, count }))
    .sort((a, b) => b.count - a.count || a.condition.localeCompare(b.condition));
}

// Squarified treemap layout. Takes items sorted descending by count and a
// box size; returns tiles with x, y, w, h in the same coordinate space.
export function treemapLayout(items, width, height) {
  const total = items.reduce((sum, i) => sum + i.count, 0);
  if (total === 0 || items.length === 0) return [];

  const scaled = items.map((i) => ({ ...i, area: (i.count / total) * width * height }));
  const tiles = [];
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;
  let row = [];

  const worstRatio = (candidates, side) => {
    const sum = candidates.reduce((s, c) => s + c.area, 0);
    const areas = candidates.map((c) => c.area);
    const max = Math.max(...areas);
    const min = Math.min(...areas);
    const sum2 = sum * sum;
    const side2 = side * side;
    return Math.max((side2 * max) / sum2, sum2 / (side2 * min));
  };

  const layoutRow = (rowItems) => {
    const sum = rowItems.reduce((s, r) => s + r.area, 0);
    if (w >= h) {
      const rowWidth = sum / h;
      let ry = y;
      for (const r of rowItems) {
        const rh = r.area / rowWidth;
        tiles.push({ condition: r.condition, count: r.count, x, y: ry, w: rowWidth, h: rh });
        ry += rh;
      }
      x += rowWidth;
      w -= rowWidth;
    } else {
      const rowHeight = sum / w;
      let rx = x;
      for (const r of rowItems) {
        const rw = r.area / rowHeight;
        tiles.push({ condition: r.condition, count: r.count, x: rx, y, w: rw, h: rowHeight });
        rx += rw;
      }
      y += rowHeight;
      h -= rowHeight;
    }
  };

  for (const item of scaled) {
    const side = Math.min(w, h);
    if (row.length > 0 && worstRatio(row, side) < worstRatio([...row, item], side)) {
      layoutRow(row);
      row = [item];
    } else {
      row.push(item);
    }
  }
  if (row.length > 0) layoutRow(row);
  return tiles;
}

// ---------- import validation and merge ----------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidEntry(e) {
  return (
    e !== null &&
    typeof e === 'object' &&
    typeof e.id === 'string' && e.id.length > 0 &&
    typeof e.dateISO === 'string' && ISO_DATE.test(e.dateISO) &&
    Array.isArray(e.conditions) &&
    e.conditions.length >= 1 &&
    e.conditions.every((c) => typeof c === 'string' && c.length > 0)
  );
}

// Checks schemaVersion and entry shape. Optional fields (category, note)
// are normalized to null when absent, so additive changes need no migration.
export function validateImport(data) {
  if (data === null || typeof data !== 'object') {
    return { ok: false, error: 'That file is not a LevelUp export.' };
  }
  if (data.schemaVersion !== 1) {
    return { ok: false, error: 'That file uses an unknown schema version.' };
  }
  if (!Array.isArray(data.entries)) {
    return { ok: false, error: 'That file has no entries list.' };
  }
  if (!data.entries.every(isValidEntry)) {
    return { ok: false, error: 'Some entries in that file are malformed.' };
  }
  const entries = data.entries.map((e) => ({
    id: e.id,
    dateISO: e.dateISO,
    conditions: [...e.conditions],
    category: typeof e.category === 'string' && e.category.length > 0 ? e.category : null,
    note: typeof e.note === 'string' && e.note.length > 0 ? e.note : null,
  }));
  return { ok: true, entries };
}

// Merge keeps everything already present and adds imported entries whose
// id is not present yet. Returns the merged list and how many were added.
export function mergeEntries(current, incoming) {
  const known = new Set(current.map((e) => e.id));
  const added = incoming.filter((e) => !known.has(e.id));
  return { entries: [...current, ...added], added: added.length };
}
