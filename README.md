# LevelUp

Log and celebrate your victories against dørstokkmila.

Dørstokkmila is the Norwegian idea of the disproportionate resistance felt at
the threshold, right before starting something against friction: bad weather,
tiredness, temptation, pain. Every time you overcome that resistance and do the
hard thing anyway, you log a victory here.

It deliberately inverts the standard habit tracker. There are no streaks, no
chains, and no "don't break it" pressure. Gaps carry no penalty at all. Each
logged win stands on its own and counts, whether the last one was yesterday or
in March.

**[Open it here](https://evelinehansen.github.io/level-up/)**

## What it does

- **Log a victory** in two taps: tick at least one condition you defeated,
  optionally add a category and a note, save.
- **Wins** shows the running count, a density heatmap of the past year, and,
  once you have five wins, a treemap and tally of the conditions you defeat most
  often.
- **History** lists every win, newest first, with edit and delete on each row.
- **Filter chips** narrow both tabs to a single category.
- **Export and import** everything as a single JSON file.
- The app opens with sample data so the idea is visible straight away, and it
  clears the moment you log your first real win.

## Running it

Open it at [the link above](https://evelinehansen.github.io/level-up/). There is
nothing to install, no build step, and no account. It works offline once loaded.

On an iPhone, open it in Safari and use Share, then Add to Home Screen. That
gives it its own icon and, importantly, stops Safari clearing your wins after a
week of not opening it.

If you clone the repo instead, the scripts are ES modules, so serve the folder
over HTTP rather than opening `index.html` from the file system:

```
python3 -m http.server 8000
```

## Where your data lives

Everything is stored in your own browser, on your own device. There is no
server, no account, and no analytics. Nothing you type is sent anywhere, and the
page makes no network requests at all once it has loaded.

That also means nobody else is keeping a copy for you:

- **Browsers clear their own storage.** Safari in particular clears data for
  sites you have not opened in about a week. Adding it to your home screen
  prevents this; using it as an ordinary bookmarked page does not.
- **Export is the real backup.** The header always shows how long ago you last
  backed up. The export is a single JSON file you can keep anywhere, and Import
  restores it with a choice to merge or replace.
- **Browser storage is not private.** Anything stored this way can be read by
  other pages served from the same address, and by software running on your
  device. It is not encrypted. Do not keep passwords or anything sensitive in
  here.

## How it's built

Plain HTML, CSS, and JavaScript. No frameworks, no build step, and no packages
pulled in from anywhere else, so the files in this repo are the whole tool: what
you can read here is what runs in your browser. There is nothing to sign in to
and no API keys or hidden configuration.

## Credits

Idea and direction by Eveline, coding by Claude. Built for my own practice,
learning and use.

Personal project, shared as is.
