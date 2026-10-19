# LoL Esports — Übersicht widget

A dark desktop widget for macOS ([Übersicht](https://tracesof.net/uebersicht/)) showing upcoming
League of Legends esports matches, plus recent results behind a spoiler guard.

- Upcoming and live matches, grouped by day, in your local time
- Pick any of the ~50 leagues and tournaments on lolesports.com (LEC, LCK, LPL, Worlds, MSI, ERLs, …)
- **Spoiler-safe results:** the results list starts collapsed, and each score stays hidden (`? : ?`) until you click it
- Drag the widget by its header; it remembers where you put it
- No setup or API key needed

## Install

```sh
git clone https://github.com/timengelbracht/lol-esports.widget \
  "$HOME/Library/Application Support/Übersicht/widgets/lol-esports.widget"
```

The widget shows up on your desktop right away.

## Choose your leagues

Edit `config.json`:

```json
{
  "leagues": ["lec", "lck", "worlds", "msi", "first_stand"]
}
```

Add or remove slugs and save. Übersicht reloads automatically. Popular slugs:

| Slug | Event | Slug | Event |
|---|---|---|---|
| `worlds` | Worlds | `lec` | LEC |
| `msi` | MSI | `lck` | LCK |
| `first_stand` | First Stand | `lpl` | LPL |
| `ewc_lol` | Esports World Cup | `lcs` | LCS |
| `emea_masters` | EMEA Masters | `lcp` | LCP |
| `lck_challengers_league` | LCK CL | `cblol-brazil` | CBLOL |
| `lfl` | LFL | `primeleague` | Prime League |

The full list is in [`lib/leagues.js`](lib/leagues.js). To see what the API offers right now
(e.g. when Riot adds a new event):

```sh
./scripts/list-leagues.sh
```

A slug that's missing from `lib/leagues.js` can go straight into `config.json` as its numeric
league ID. To change a league's badge label or color, edit its entry in `lib/leagues.js`.

## All options

| Key | Default | What it does |
|---|---|---|
| `leagues` | LEC, LCS, LCK, LPL, FST, MSI, Worlds | Slugs (or numeric IDs) to track |
| `upcoming.max` | `12` | Max upcoming matches shown |
| `results.show` | `true` | Show the recent results section |
| `results.max` | `6` | Number of recent results |
| `results.hideSpoilers` | `true` | Start collapsed with scores hidden until clicked; `false` shows everything |
| `refreshMinutes` | `5` | How often to refresh |
| `hour12` | `false` | `true` = 7:00 PM, `false` = 19:00, `null` = system default |
| `position` | `{"bottom": "100px", "left": "20px"}` | Starting position (any of `top`/`right`/`bottom`/`left`) |

Clicked-open scores reset whenever Übersicht reloads the widget. Note that upcoming bracket matches
can give results away (a team that shows up in the next round evidently won).

### Updating

```sh
cd "$HOME/Library/Application Support/Übersicht/widgets/lol-esports.widget"
git stash && git pull && git stash pop   # keeps your config.json edits
```

## Data source

This uses the unofficial lolesports.com API, with the public key the site itself sends to every
browser. It isn't affiliated with or endorsed by Riot Games, and it may break if Riot changes the API.

## License

MIT
