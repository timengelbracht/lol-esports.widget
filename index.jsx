// LoL Esports Schedule — Übersicht Widget
// Pick your leagues and options in config.json; see README.md.

import config from "./config.json";
import CATALOG from "./lib/leagues.js";

// Public key that lolesports.com itself ships to every browser.
const API_KEY = "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z";
const FALLBACK_COLOR = "#8A8F98";

// Slugs resolve via the catalog; a raw numeric league id also works.
const leagues = config.leagues.map((key) => {
  if (CATALOG[key]) return { key, ...CATALOG[key] };
  if (/^\d+$/.test(key)) return { key, id: key, label: "?", color: FALLBACK_COLOR };
  return { key, unknown: true };
});
const unknownLeagues = leagues.filter((l) => l.unknown).map((l) => l.key);
const leagueIds = leagues.filter((l) => !l.unknown).map((l) => l.id).join(",");

const results = { show: true, max: 6, hideSpoilers: true, ...config.results };
const maxUpcoming = config.upcoming?.max ?? 12;

export const command = `curl -sf "https://esports-api.lolesports.com/persisted/gw/getSchedule?hl=en-US&leagueId=${leagueIds}" -H "x-api-key: ${API_KEY}"`;

export const refreshFrequency = (config.refreshMinutes ?? 5) * 60 * 1000;

export const initialState = {
  output: null,
  error: null,
  resultsOpen: !results.hideSpoilers,
  revealed: {},
};

export const updateState = (event, prev) => {
  switch (event.type) {
    case "UB/COMMAND_RAN":
      return { ...prev, output: event.output, error: event.error };
    case "TOGGLE_RESULTS":
      return { ...prev, resultsOpen: !prev.resultsOpen };
    case "REVEAL":
      return { ...prev, revealed: { ...prev.revealed, [event.id]: true } };
    case "REVEAL_ALL":
      return { ...prev, revealed: Object.fromEntries(event.ids.map((id) => [id, true])) };
    default:
      return prev;
  }
};

function formatTime(iso) {
  const opts = { hour: "2-digit", minute: "2-digit" };
  // hourCycle avoids "24:00" at midnight that hour12:false produces.
  if (config.hour12 === true) opts.hour12 = true;
  if (config.hour12 === false) opts.hourCycle = "h23";
  return new Date(iso).toLocaleTimeString([], opts);
}

function formatDay(iso) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function timeUntil(iso) {
  const diff = new Date(iso) - Date.now();
  if (diff <= 0) return "Now";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}

function groupByDay(events) {
  const groups = {};
  for (const ev of events) {
    const day = formatDay(ev.startTime);
    if (!groups[day]) groups[day] = [];
    groups[day].push(ev);
  }
  return groups;
}

function leagueMeta(ev) {
  const slug = ev.league?.slug?.toLowerCase() || "";
  return CATALOG[slug] || { label: ev.league?.name || "?", color: FALLBACK_COLOR };
}

function matchId(ev) {
  return ev.match?.id || `${ev.startTime}-${ev.league?.slug}`;
}

// Drag the widget by its header; position is remembered in localStorage.
function makeDraggable(el) {
  if (!el || el.dataset.draggable) return;
  el.dataset.draggable = "1";
  const handle = el.querySelector(".header");
  if (!handle) return;

  try {
    const pos = JSON.parse(localStorage.getItem("lol-widget-pos") || "null");
    if (pos) Object.assign(el.style, { top: pos.top, left: pos.left, right: "auto", bottom: "auto" });
  } catch (e) {}

  let dragging = false, ox = 0, oy = 0;
  handle.addEventListener("mousedown", (e) => {
    dragging = true;
    ox = e.clientX - el.offsetLeft;
    oy = e.clientY - el.offsetTop;
    e.preventDefault();
  });
  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    Object.assign(el.style, {
      left: `${e.clientX - ox}px`, top: `${e.clientY - oy}px`, right: "auto", bottom: "auto",
    });
  });
  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    try {
      localStorage.setItem("lol-widget-pos", JSON.stringify({ left: el.style.left, top: el.style.top }));
    } catch (e) {}
  });
}

function Message({ icon, text, sub }) {
  return (
    <div className="widget message">
      <div className="message-icon">{icon}</div>
      <div className="message-text">{text}</div>
      {sub && <div className="message-sub">{sub}</div>}
    </div>
  );
}

function UpcomingRow({ ev }) {
  const [t1, t2] = ev.match?.teams || [];
  const meta = leagueMeta(ev);
  const isLive = ev.state === "inProgress";

  return (
    <div className={`match-row ${isLive ? "live" : ""}`}>
      <div className="match-left">
        <span className="league-badge" style={{ color: meta.color, borderColor: meta.color }}>
          {meta.label}
        </span>
      </div>
      <div className="match-teams">
        <span className="team-code">{t1?.code || "TBD"}</span>
        <span className="vs">vs</span>
        <span className="team-code">{t2?.code || "TBD"}</span>
      </div>
      <div className="match-right">
        {isLive && <span className="live-dot" />}
        <span className={`match-time ${isLive ? "live-text" : ""}`}>
          {isLive ? "LIVE" : formatTime(ev.startTime)}
        </span>
        {!isLive && <span className="match-until">{timeUntil(ev.startTime)}</span>}
      </div>
    </div>
  );
}

function ResultRow({ ev, revealed, dispatch }) {
  const [t1, t2] = ev.match?.teams || [];
  const meta = leagueMeta(ev);
  const id = matchId(ev);
  const winner = (t) => revealed && t?.result?.outcome === "win";

  return (
    <div className="match-row result">
      <div className="match-left">
        <span className="league-badge" style={{ color: meta.color, borderColor: meta.color }}>
          {meta.label}
        </span>
      </div>
      <div className="match-teams">
        <span className={`team-code ${winner(t1) ? "winner" : ""}`}>{t1?.code || "TBD"}</span>
        {revealed ? (
          <span className="score">
            {t1?.result?.gameWins ?? "–"} : {t2?.result?.gameWins ?? "–"}
          </span>
        ) : (
          <span className="score hidden" title="Click to reveal" onClick={() => dispatch({ type: "REVEAL", id })}>
            ? : ?
          </span>
        )}
        <span className={`team-code ${winner(t2) ? "winner" : ""}`}>{t2?.code || "TBD"}</span>
      </div>
      <div className="match-right">
        <span className="match-until">{formatDay(ev.startTime)}</span>
      </div>
    </div>
  );
}

function ResultsSection({ events, state, dispatch }) {
  const ids = events.map(matchId);
  const allRevealed = !results.hideSpoilers || ids.every((id) => state.revealed[id]);

  return (
    <div className="results">
      <div className="section-label clickable" onClick={() => dispatch({ type: "TOGGLE_RESULTS" })}>
        <span>{state.resultsOpen ? "▾" : "▸"} Results</span>
        {state.resultsOpen && !allRevealed && (
          <span
            className="reveal-all"
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "REVEAL_ALL", ids });
            }}
          >
            reveal all
          </span>
        )}
        {!state.resultsOpen && <span className="spoiler-note">spoilers hidden</span>}
      </div>
      {state.resultsOpen &&
        events.map((ev) => (
          <ResultRow
            key={matchId(ev)}
            ev={ev}
            revealed={!results.hideSpoilers || !!state.revealed[matchId(ev)]}
            dispatch={dispatch}
          />
        ))}
    </div>
  );
}

export const render = (state, dispatch) => {
  const { output, error } = state;
  if (!leagueIds) return <Message icon="⚙" text="No valid leagues in config.json" />;
  if (!output) {
    if (error) return <Message icon="⚠" text="Could not load schedule" />;
    return <Message icon="⏳" text="Loading…" />;
  }

  let upcoming = [];
  let past = [];
  try {
    const raw = JSON.parse(output)?.data?.schedule?.events || [];
    const matches = raw.filter((ev) => ev.type === "match");
    const now = Date.now();

    upcoming = matches
      .filter(
        (ev) =>
          (ev.state === "unstarted" || ev.state === "inProgress") &&
          new Date(ev.startTime).getTime() > now - 3 * 60 * 60 * 1000 // keep live games up to 3h in
      )
      .slice(0, maxUpcoming);

    past = results.show
      ? matches
          .filter((ev) => ev.state === "completed")
          .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
          .slice(0, results.max)
      : [];
  } catch (e) {
    return <Message icon="⚠" text="Parse error" />;
  }

  return (
    <div className="widget" ref={makeDraggable}>
      <div className="header">
        <span className="header-title">LoL Esports</span>
        <span className="header-dot" />
        <span className="header-sub">Upcoming</span>
      </div>

      {upcoming.length === 0 && <div className="empty-line">No upcoming matches</div>}
      {Object.entries(groupByDay(upcoming)).map(([day, dayEvents]) => (
        <div key={day} className="day-group">
          <div className="section-label">{day}</div>
          {dayEvents.map((ev) => (
            <UpcomingRow key={matchId(ev)} ev={ev} />
          ))}
        </div>
      ))}

      {past.length > 0 && <ResultsSection events={past} state={state} dispatch={dispatch} />}

      <div className="footer">
        {unknownLeagues.length > 0 && (
          <span className="warn">Unknown in config: {unknownLeagues.join(", ")} · </span>
        )}
        Updated {formatTime(new Date().toISOString())}
      </div>
    </div>
  );
};

const pos = config.position || { bottom: "100px", left: "20px" };
const posCss = ["top", "right", "bottom", "left"]
  .filter((k) => pos[k] != null)
  .map((k) => `${k}: ${pos[k]};`)
  .join(" ");

export const className = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&family=Barlow:wght@400;500&display=swap');

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .widget {
    position: fixed;
    ${posCss}
    width: 340px;
    max-height: 420px;
    overflow-y: auto;
    background: rgba(8, 10, 18, 0.88);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(200, 155, 60, 0.25);
    border-radius: 30px;
    padding: 16px;
    font-family: 'Barlow', sans-serif;
    color: #e2d9c8;
    box-shadow:
      0 0 0 1px rgba(0,0,0,0.5),
      0 8px 32px rgba(0,0,0,0.6),
      inset 0 1px 0 rgba(200,155,60,0.1);
  }

  .header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(200, 155, 60, 0.2);
    cursor: grab;
  }

  .header-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 15px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #C89B3C;
  }

  .header-dot {
    width: 3px;
    height: 3px;
    background: rgba(200,155,60,0.4);
    border-radius: 50%;
  }

  .header-sub {
    font-size: 11px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: rgba(226, 217, 200, 0.4);
    font-weight: 500;
  }

  .day-group {
    margin-bottom: 10px;
  }

  .section-label {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: rgba(226, 217, 200, 0.35);
    margin-bottom: 6px;
    padding-left: 2px;
  }

  .clickable { cursor: pointer; }
  .clickable:hover { color: rgba(226, 217, 200, 0.6); }

  .reveal-all, .spoiler-note {
    font-size: 9px;
    letter-spacing: 1px;
    color: rgba(200, 155, 60, 0.55);
  }
  .reveal-all:hover { color: #C89B3C; }

  .results {
    margin-top: 4px;
    padding-top: 10px;
    border-top: 1px solid rgba(200, 155, 60, 0.1);
  }

  .empty-line {
    font-size: 11px;
    color: rgba(226, 217, 200, 0.4);
    text-align: center;
    padding: 6px 0 12px;
  }

  .match-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 10px;
    margin-bottom: 4px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 7px;
    transition: background 0.2s;
  }

  .match-row.live {
    background: rgba(255, 60, 60, 0.07);
    border-color: rgba(255, 60, 60, 0.2);
  }

  .match-row.result .team-code { color: rgba(226, 217, 200, 0.6); }
  .match-row.result .team-code.winner { color: #e2d9c8; }

  .match-left {
    width: 38px;
    flex-shrink: 0;
  }

  .league-badge {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    border: 1px solid;
    border-radius: 3px;
    padding: 1px 4px;
    opacity: 0.9;
  }

  .match-teams {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .team-code {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.5px;
    color: #e2d9c8;
    min-width: 36px;
    text-align: center;
  }

  .vs {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: rgba(226, 217, 200, 0.25);
  }

  .score {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 13px;
    color: #C89B3C;
    min-width: 34px;
    text-align: center;
  }

  .score.hidden {
    color: rgba(226, 217, 200, 0.35);
    background: rgba(255,255,255,0.08);
    border-radius: 4px;
    padding: 0 4px;
    cursor: pointer;
  }
  .score.hidden:hover { background: rgba(200,155,60,0.2); color: #C89B3C; }

  .match-right {
    width: 56px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-direction: column;
    text-align: right;
    gap: 1px;
  }

  .match-time {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 600;
    font-size: 12px;
    color: rgba(226, 217, 200, 0.75);
    letter-spacing: 0.3px;
  }

  .match-time.live-text {
    color: #ff5555;
    font-weight: 700;
    letter-spacing: 1px;
  }

  .match-until {
    font-size: 9px;
    color: rgba(226, 217, 200, 0.3);
    letter-spacing: 0.2px;
  }

  .live-dot {
    width: 5px;
    height: 5px;
    background: #ff4444;
    border-radius: 50%;
    margin-right: 4px;
    animation: pulse 1.4s ease-in-out infinite;
    display: inline-block;
    vertical-align: middle;
    margin-bottom: 1px;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.7); }
  }

  .footer {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid rgba(200, 155, 60, 0.1);
    font-size: 9px;
    color: rgba(226, 217, 200, 0.2);
    text-align: right;
    letter-spacing: 0.5px;
  }

  .warn { color: rgba(255, 120, 80, 0.7); }

  .message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 80px;
  }

  .message-icon {
    font-size: 22px;
    margin-bottom: 4px;
  }

  .message-text { font-size: 12px; }
  .message-sub { font-size: 10px; color: rgba(226, 217, 200, 0.4); }
`;
