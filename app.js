// app.js - state, rendering, and event wiring. All derivation logic lives in
// engine.js; all persistence in storage.js. Every change autosaves.

import {
  CONDITIONS, MIN_FOR_BREAKDOWN,
  toISODate, filterByCategory, categoriesOf, sortNewestFirst,
  heatmapModel, conditionCounts, treemapLayout,
  validateImport, mergeEntries,
} from './engine.js';
import {
  loadEntries, saveEntries, loadBackupTime, saveBackupTime, exportPayload,
} from './storage.js';
import { makeSeedEntries } from './seed.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const HEAT_COLORS = ['var(--heat-0)', 'var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)', 'var(--heat-4)'];
const dateFmt = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'short' });
const weekdayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });

const state = {
  entries: [],
  seeded: false,       // true while showing in-memory sample data
  filter: null,        // null = all categories
  tab: 'wins',
  editingId: null,     // id of the entry open in the form, or null for a new win
  confirmingId: null,  // id of the history row showing its delete confirmation
};

const el = (id) => document.getElementById(id);

// ---------- persistence ----------

// Seed data is never written to localStorage; it exists only to demo the app.
function persist() {
  if (state.seeded) return;
  const ok = saveEntries(state.entries);
  el('save-warning').hidden = ok;
}

// ---------- small helpers ----------

function timesText(n) {
  return n === 1 ? '1 time' : `${n} times`;
}

function defeatedText(n) {
  if (n === 1) return 'defeated once';
  if (n === 2) return 'defeated twice';
  return `defeated ${n} times`;
}

function backupStatusText() {
  const ts = loadBackupTime();
  if (ts === null) return 'Last backup: never';
  const then = new Date(ts);
  then.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today - then) / 86400000);
  if (days <= 0) return 'Last backup: today';
  if (days === 1) return 'Last backup: yesterday';
  return `Last backup: ${days} days ago`;
}

function svgEl(name, attrs) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

// ---------- rendering ----------

function renderAll(options = {}) {
  renderHeader();
  renderTabs();
  renderFilters();
  renderWins(options);
  renderHistory();
  el('seed-note').hidden = !state.seeded;
}

function renderHeader() {
  el('backup-status').textContent = backupStatusText();
}

function renderTabs() {
  const badge = el('wins-badge');
  const total = state.entries.length;
  badge.hidden = total === 0;
  badge.textContent = String(total);
  el('tab-wins').setAttribute('aria-selected', String(state.tab === 'wins'));
  el('tab-history').setAttribute('aria-selected', String(state.tab === 'history'));
  el('panel-wins').hidden = state.tab !== 'wins';
  el('panel-history').hidden = state.tab !== 'history';
}

function renderFilters() {
  const row = el('filter-row');
  const cats = categoriesOf(state.entries);
  // Drop a filter that no longer matches any entry
  if (state.filter !== null && !cats.includes(state.filter)) state.filter = null;
  row.hidden = cats.length === 0;
  row.replaceChildren();
  if (cats.length === 0) return;

  const makeChip = (label, value) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'filter-chip';
    chip.textContent = label;
    chip.setAttribute('aria-pressed', String(state.filter === value));
    chip.addEventListener('click', () => {
      state.filter = value;
      renderAll();
    });
    return chip;
  };

  row.append(makeChip('All categories', null));
  for (const cat of cats) row.append(makeChip(cat, cat));
}

function renderWins({ celebrate = false } = {}) {
  const filtered = filterByCategory(state.entries, state.filter);
  const isEmpty = state.entries.length === 0;

  el('empty-state').hidden = !isEmpty;
  el('headline').hidden = isEmpty;
  el('heatmap-card').hidden = isEmpty;

  if (isEmpty) {
    el('treemap-card').hidden = true;
    el('table-card').hidden = true;
    el('reveal-card').hidden = true;
    return;
  }

  // Headline stat (this screen's one serif moment, and the one deliberate
  // family departure: it celebrates at the user).
  const countEl = el('headline-count');
  countEl.textContent = timesText(filtered.length);
  if (celebrate) {
    countEl.classList.remove('pop');
    // Restart the animation even when the class was already applied
    void countEl.offsetWidth;
    countEl.classList.add('pop');
  }

  renderHeatmap(filtered);

  // No fake precision: breakdown only above an honest minimum of entries
  const enough = filtered.length >= MIN_FOR_BREAKDOWN;
  el('treemap-card').hidden = !enough;
  el('table-card').hidden = !enough;
  el('reveal-card').hidden = enough;
  if (enough) {
    const counts = conditionCounts(filtered);
    renderTreemap(counts);
    renderConditionTable(counts);
  } else {
    el('reveal-copy').textContent =
      `The condition breakdown appears after ${MIN_FOR_BREAKDOWN} wins. ` +
      `You have logged ${timesText(filtered.length)} so far.`;
    el('reveal-fill').style.width = `${(filtered.length / MIN_FOR_BREAKDOWN) * 100}%`;
  }
}

function renderHeatmap(entries) {
  const weeks = heatmapModel(entries);
  const cell = 12;
  const gap = 3;
  const left = 34;   // width of the pinned weekday-label column
  const top = 18;    // room for month labels
  const width = weeks.length * (cell + gap);
  const height = top + 7 * (cell + gap);

  // Weekday labels (Monday-first) live in their own SVG outside the
  // horizontal scroller, so they stay visible while the grid scrolls.
  const daysSvg = el('heatmap-days');
  daysSvg.setAttribute('width', left);
  daysSvg.setAttribute('height', height);
  daysSvg.setAttribute('viewBox', `0 0 ${left} ${height}`);
  daysSvg.replaceChildren();
  for (const row of [0, 2, 4]) {
    const label = svgEl('text', {
      x: 0,
      y: top + row * (cell + gap) + cell - 2,
      'font-size': 9,
      fill: 'var(--ink-faint)',
    });
    label.textContent = weekdayFmt.format(weeks[0][row].date);
    daysSvg.append(label);
  }

  const svg = el('heatmap-svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.replaceChildren();

  let prevMonth = -1;
  weeks.forEach((week, w) => {
    // Month label above the column where a new month starts
    const month = week[0].date.getMonth();
    if (month !== prevMonth) {
      if (prevMonth !== -1 || w === 0) {
        const label = svgEl('text', {
          x: w * (cell + gap),
          y: 10,
          'font-size': 9,
          fill: 'var(--ink-faint)',
        });
        label.textContent = monthFmt.format(week[0].date);
        svg.append(label);
      }
      prevMonth = month;
    }

    week.forEach((day, d) => {
      if (day.future) return;
      const rect = svgEl('rect', {
        x: w * (cell + gap),
        y: top + d * (cell + gap),
        width: cell,
        height: cell,
        rx: 3,
        fill: HEAT_COLORS[day.level],
      });
      const title = svgEl('title', {});
      title.textContent = `${dateFmt.format(day.date)}: ${day.count === 0 ? 'no wins' : `${day.count} ${day.count === 1 ? 'condition' : 'conditions'} defeated`}`;
      rect.append(title);
      svg.append(rect);
    });
  });

  // Scroll so the most recent weeks are visible first
  const scroller = svg.parentElement;
  requestAnimationFrame(() => { scroller.scrollLeft = scroller.scrollWidth; });
}

function renderTreemap(counts) {
  const width = 600;
  const height = 340;
  const svg = el('treemap-svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.replaceChildren();

  const tiles = treemapLayout(counts, width, height);
  const maxCount = counts.length ? counts[0].count : 1;

  for (const tile of tiles) {
    const g = svgEl('g', {});
    const share = tile.count / maxCount;
    // Bigger tiles get deeper sage; small ones stay light so labels read
    const fill = share > 0.66 ? 'var(--heat-3)' : share > 0.33 ? 'var(--heat-2)' : 'var(--heat-1)';
    const dark = share > 0.33;
    const pad = 2;
    const rect = svgEl('rect', {
      x: tile.x + pad, y: tile.y + pad,
      width: Math.max(tile.w - pad * 2, 1), height: Math.max(tile.h - pad * 2, 1),
      rx: 6,
      fill,
    });
    const title = svgEl('title', {});
    title.textContent = `${tile.condition}, ${defeatedText(tile.count)}`;
    rect.append(title);
    g.append(rect);

    // Label only when it fits inside the tile (rough 7.5px per character)
    if (tile.w - 18 > tile.condition.length * 7 && tile.h > 34) {
      const name = svgEl('text', {
        x: tile.x + 10, y: tile.y + 22,
        'font-size': 13, 'font-weight': 600,
        fill: dark ? '#FFFFFF' : 'var(--sage-deep)',
      });
      name.textContent = tile.condition;
      g.append(name);
      if (tile.h > 52 && tile.w - 18 > defeatedText(tile.count).length * 5.4) {
        const count = svgEl('text', {
          x: tile.x + 10, y: tile.y + 39,
          'font-size': 11,
          fill: dark ? 'rgba(255,255,255,0.85)' : 'var(--sage-deep)',
        });
        count.textContent = defeatedText(tile.count);
        g.append(count);
      }
    }
    svg.append(g);
  }
}

function renderConditionTable(counts) {
  const list = el('condition-table');
  list.replaceChildren();
  for (const { condition, count } of counts) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'condition-name';
    name.textContent = condition;
    const num = document.createElement('span');
    num.className = 'condition-count';
    num.textContent = defeatedText(count);
    li.append(name, num);
    list.append(li);
  }
}

function renderHistory() {
  const filtered = sortNewestFirst(filterByCategory(state.entries, state.filter));
  el('history-empty').hidden = filtered.length > 0;
  const list = el('history-list');
  list.replaceChildren();

  for (const entry of filtered) {
    const li = document.createElement('li');
    li.className = 'history-row card';

    const main = document.createElement('div');
    const topLine = document.createElement('div');
    const date = document.createElement('span');
    date.className = 'history-date';
    date.textContent = dateFmt.format(new Date(entry.dateISO + 'T12:00:00'));
    topLine.append(date);
    if (entry.category) {
      const cat = document.createElement('span');
      cat.className = 'history-category';
      cat.textContent = entry.category;
      topLine.append(cat);
    }
    const conds = document.createElement('div');
    conds.className = 'history-conditions';
    conds.textContent = entry.conditions.join(', ');
    main.append(topLine, conds);
    if (entry.note) {
      const note = document.createElement('div');
      note.className = 'history-note';
      note.textContent = entry.note;
      main.append(note);
    }

    const actions = document.createElement('div');
    actions.className = 'history-actions';
    if (state.confirmingId === entry.id) {
      const text = document.createElement('span');
      text.className = 'confirm-text';
      text.textContent = 'Delete this win?';
      const yes = document.createElement('button');
      yes.type = 'button';
      yes.className = 'btn danger';
      yes.textContent = 'Delete';
      yes.addEventListener('click', () => deleteEntry(entry.id));
      const no = document.createElement('button');
      no.type = 'button';
      no.className = 'btn ghost';
      no.textContent = 'Cancel';
      no.addEventListener('click', () => {
        state.confirmingId = null;
        renderHistory();
      });
      actions.append(text, yes, no);
    } else {
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => openForm(entry));
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn danger';
      del.textContent = 'Delete';
      del.addEventListener('click', () => {
        state.confirmingId = entry.id;
        renderHistory();
      });
      actions.append(edit, del);
    }

    li.append(main, actions);
    list.append(li);
  }
}

// ---------- entry mutations ----------

function deleteEntry(id) {
  state.entries = state.entries.filter((e) => e.id !== id);
  state.confirmingId = null;
  persist();
  renderAll();
}

// ---------- log / edit form ----------

function openForm(entry = null) {
  state.editingId = entry ? entry.id : null;
  el('form-title').textContent = entry ? 'Edit win' : 'Log a victory';
  el('form-save').textContent = entry ? 'Save changes' : 'Save win';

  const dateLine = el('form-date');
  if (entry) {
    dateLine.textContent = `Logged ${dateFmt.format(new Date(entry.dateISO + 'T12:00:00'))}`;
    dateLine.hidden = false;
  } else {
    dateLine.hidden = true;
  }

  // Build the condition checkboxes fresh each time
  const checks = el('condition-checks');
  checks.replaceChildren();
  for (const condition of CONDITIONS) {
    const label = document.createElement('label');
    label.className = 'condition-check';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.value = condition;
    box.checked = entry ? entry.conditions.includes(condition) : false;
    box.addEventListener('change', updateSaveEnabled);
    label.append(box, document.createTextNode(condition));
    checks.append(label);
  }

  // Offer existing categories as suggestions
  const datalist = el('category-options');
  datalist.replaceChildren();
  for (const cat of categoriesOf(state.entries)) {
    const opt = document.createElement('option');
    opt.value = cat;
    datalist.append(opt);
  }

  el('category-input').value = entry && entry.category ? entry.category : '';
  el('note-input').value = entry && entry.note ? entry.note : '';
  updateSaveEnabled();

  el('form-backdrop').hidden = false;
  el('form-panel').hidden = false;
  document.body.classList.add('modal-open');
  // Focus the first checkbox so keyboard users can tick and save immediately
  checks.querySelector('input').focus();
}

function closeForm() {
  el('form-backdrop').hidden = true;
  el('form-panel').hidden = true;
  document.body.classList.remove('modal-open');
  state.editingId = null;
}

function checkedConditions() {
  return [...el('condition-checks').querySelectorAll('input:checked')].map((b) => b.value);
}

function updateSaveEnabled() {
  el('form-save').disabled = checkedConditions().length === 0;
}

function submitForm(event) {
  event.preventDefault();
  const conditions = checkedConditions();
  if (conditions.length === 0) return;
  const category = el('category-input').value.trim() || null;
  const note = el('note-input').value.trim() || null;

  if (state.editingId !== null) {
    const entry = state.entries.find((e) => e.id === state.editingId);
    if (entry) {
      entry.conditions = conditions;
      entry.category = category;
      entry.note = note;
    }
    persist();
    closeForm();
    renderAll();
  } else {
    const entry = {
      id: crypto.randomUUID(),
      dateISO: toISODate(new Date()),
      conditions,
      category,
      note,
    };
    // The first real win clears the sample data
    if (state.seeded) {
      state.entries = [entry];
      state.seeded = false;
    } else {
      state.entries.push(entry);
    }
    persist();
    closeForm();
    state.tab = 'wins';
    renderAll({ celebrate: true });
  }
}

// ---------- export / import ----------

function doExport() {
  const blob = new Blob([exportPayload(state.entries)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `levelup-${toISODate(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
  saveBackupTime(Date.now());
  renderHeader();
}

let pendingImport = null;

function handleImportFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try {
      data = JSON.parse(reader.result);
    } catch (e) {
      alert('That file is not valid JSON.');
      return;
    }
    const result = validateImport(data);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    // Merging into sample data makes no sense; just take the import
    if (state.seeded || state.entries.length === 0) {
      applyImport(result.entries, 'replace');
      return;
    }
    pendingImport = result.entries;
    el('import-summary').textContent =
      `The file holds ${timesText(result.entries.length).replace('time', 'win')}. ` +
      `Merge adds the ones you do not have yet and keeps everything current. ` +
      `Replace throws away the ${timesText(state.entries.length).replace('time', 'win')} stored here.`;
    el('import-backdrop').hidden = false;
    el('import-dialog').hidden = false;
    document.body.classList.add('modal-open');
  };
  reader.readAsText(file);
}

function applyImport(entries, mode) {
  if (mode === 'merge') {
    state.entries = mergeEntries(state.entries, entries).entries;
  } else {
    state.entries = entries;
  }
  state.seeded = false;
  closeImportDialog();
  persist();
  renderAll();
}

function closeImportDialog() {
  pendingImport = null;
  el('import-backdrop').hidden = true;
  el('import-dialog').hidden = true;
  document.body.classList.remove('modal-open');
}

// ---------- init ----------

function init() {
  const stored = loadEntries();
  if (stored === null) {
    state.entries = makeSeedEntries();
    state.seeded = true;
  } else {
    state.entries = stored;
  }

  el('tab-wins').addEventListener('click', () => { state.tab = 'wins'; renderTabs(); });
  el('tab-history').addEventListener('click', () => { state.tab = 'history'; renderTabs(); });

  el('log-btn').addEventListener('click', () => openForm());
  el('win-form').addEventListener('submit', submitForm);
  el('form-cancel').addEventListener('click', closeForm);
  el('form-backdrop').addEventListener('click', closeForm);

  el('export-btn').addEventListener('click', doExport);
  el('import-btn').addEventListener('click', () => el('import-file').click());
  el('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleImportFile(file);
    e.target.value = '';
  });
  el('import-merge').addEventListener('click', () => applyImport(pendingImport, 'merge'));
  el('import-replace').addEventListener('click', () => applyImport(pendingImport, 'replace'));
  el('import-cancel').addEventListener('click', closeImportDialog);
  el('import-backdrop').addEventListener('click', closeImportDialog);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!el('form-panel').hidden) closeForm();
      if (!el('import-dialog').hidden) closeImportDialog();
    }
  });

  renderAll();
}

init();
