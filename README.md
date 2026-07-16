# LevelUp

Log and celebrate your victories against dørstokkmila.

Dørstokkmila is the Norwegian idea of the disproportionate resistance felt at
the threshold, right before starting something against friction (bad weather,
tiredness, temptation, pain). Every time you overcome that resistance and do
the hard thing anyway, you log a victory here.

LevelUp deliberately inverts the standard habit tracker: there are no streaks,
no chains, and no "don't break it" pressure. Gaps carry no penalty. Each
logged win stands alone and counts.

## Using it

- **Log a victory** opens a short form. Tick at least one condition you
  defeated, optionally add a category and a note, and save. Two taps is all a
  log needs.
- **Wins** shows the running count, a density heatmap of the past year, and
  (after five wins) a treemap and tally of the conditions you defeat most.
- **History** lists every win, newest first, with edit and delete on each row.
- **Filter chips** narrow both tabs to a single category.
- The app opens with sample data so the concept is visible immediately; it
  clears the moment you log your first real win.

## Your data

Everything lives in your browser's localStorage. There is no backend, no
account, no analytics, and zero network requests at runtime.

Two plain warnings about localStorage:

- It is readable by any page on this origin and is not private from software
  on your device.
- Browsers can evict it (Safari after about seven days of disuse). The export
  file is the real home of your data: use **Export** regularly. The header
  shows how long ago you last backed up, and **Import** restores from an
  export file with a choice to merge or replace.

## Files

Vanilla HTML, CSS, and JavaScript as ES modules. No frameworks, no build
step, no npm.

```
index.html    styles.css    app.js    engine.js    storage.js    seed.js    icon.png
```

- `engine.js` holds pure derivation logic (counts, heatmap buckets, treemap
  layout, import validation), no DOM.
- `storage.js` handles localStorage, the export payload, and backup-age
  tracking.
- `seed.js` holds the sample data shown to first-time visitors.

Part of a small family of static, local-first tools that share the same
design system and conventions.
