export const TIMEZONE = 'Europe/Helsinki';
export const STALE_AFTER_MS = 8 * 24 * 60 * 60 * 1000;
const MODES = new Set(['empty', 'demo', 'live']);
const MATCH_STATUSES = new Set(['scheduled', 'final', 'postponed', 'cancelled', 'time-tbc']);
const STANDING_STATUSES = new Set(['available', 'not-published', 'unavailable']);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const integer = value => Number.isInteger(value) && value >= 0;

export function isZonedInstant(value) {
  if (typeof value !== 'string') return false;
  const parts = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
  return Boolean(parts && isDateKey(parts[1]) && +parts[2] < 24 && +parts[3] < 60 && +parts[4] < 60 && Number.isFinite(Date.parse(value)));
}

export function isHttpsUrl(value) {
  if (!nonempty(value)) return false;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port && !/\s/.test(value); } catch { return false; }
}

export function validateSnapshot(data) {
  const errors = [];
  const check = (condition, text) => { if (!condition) errors.push(text); };
  if (!isRecord(data)) return { ok: false, errors: ['Snapshot must be an object.'] };
  check(data.schemaVersion === 1, 'Unsupported schemaVersion.');
  check(MODES.has(data.mode), 'Invalid mode.');
  check(data.timezone === TIMEZONE, 'Invalid timezone.');
  check(data.mode === 'empty' ? data.generatedAt === null : isZonedInstant(data.generatedAt), 'Invalid generatedAt.');
  for (const key of ['sources', 'teams', 'competitions', 'venues', 'matches', 'standings']) check(Array.isArray(data[key]), key + ' must be an array.');
  if (errors.length) return { ok: false, errors };
  const makeIds = (items, label) => {
    const ids = new Set();
    for (const item of items) {
      if (!isRecord(item)) { errors.push(label + ' has a non-object item.'); continue; }
      check(nonempty(item.id) && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(item.id) && item.id.length <= 180, label + ' has an invalid id.');
      check(!ids.has(item.id), label + ' has duplicate ids.'); ids.add(item.id);
    }
    return ids;
  };
  const sourceIds = makeIds(data.sources, 'sources'), teamIds = makeIds(data.teams, 'teams');
  const competitionIds = makeIds(data.competitions, 'competitions'), venueIds = makeIds(data.venues, 'venues');
  makeIds(data.matches, 'matches');
  if (errors.length) return { ok: false, errors };
  for (const source of data.sources) {
    check(nonempty(source.label) && isHttpsUrl(source.url) && isZonedInstant(source.fetchedAt), 'Invalid source metadata.');
    check(Date.parse(source.fetchedAt) <= Date.parse(data.generatedAt), 'Source fetched after snapshot.');
  }
  for (const team of data.teams) {
    check(nonempty(team.name) && nonempty(team.shortName), 'Invalid team name.');
    check(['adult', 'junior'].includes(team.category) && typeof team.tracked === 'boolean', 'Invalid team category or tracked flag.');
    check(Array.isArray(team.competitionIds) && team.competitionIds.every(id => competitionIds.has(id)) && new Set(team.competitionIds).size === team.competitionIds.length, 'Invalid team competition references.');
  }
  for (const competition of data.competitions) {
    check(nonempty(competition.name) && nonempty(competition.season) && (competition.phase === null || nonempty(competition.phase)), 'Invalid competition metadata.');
  }
  for (const venue of data.venues) check(nonempty(venue.name) && (venue.city === null || nonempty(venue.city)) && (venue.address === null || nonempty(venue.address)), 'Invalid venue.');
  const teamsById = new Map(data.teams.map(team => [team.id, team]));
  for (const match of data.matches) {
    check(competitionIds.has(match.competitionId) && teamIds.has(match.homeTeamId) && teamIds.has(match.awayTeamId) && match.homeTeamId !== match.awayTeamId, 'Broken match team or competition reference.');
    check(match.venueId === null || venueIds.has(match.venueId), 'Broken venue reference.');
    check(sourceIds.has(match.sourceId) && isHttpsUrl(match.sourceUrl), 'Invalid match source.');
    check(MATCH_STATUSES.has(match.status) && (match.startsAt === null || isZonedInstant(match.startsAt)), 'Invalid match status or time.');
    check(match.status !== 'scheduled' || isZonedInstant(match.startsAt), 'Scheduled match requires a start time.');
    check(match.status === 'final' ? integer(match.homeScore) && integer(match.awayScore) : match.homeScore === null && match.awayScore === null, 'Invalid match scores.');
    check([match.homeTeamId, match.awayTeamId].every(id => teamsById.get(id)?.competitionIds?.includes(match.competitionId)), 'Match team does not belong to competition.');
  }
  const standingCompetitions = new Set();
  for (const standing of data.standings) {
    if (!isRecord(standing)) { errors.push('Invalid standings item.'); continue; }
    check(competitionIds.has(standing.competitionId) && !standingCompetitions.has(standing.competitionId), 'Invalid or duplicated standings competition.');
    standingCompetitions.add(standing.competitionId);
    check(STANDING_STATUSES.has(standing.status) && Array.isArray(standing.rows), 'Invalid standings status or rows.');
    if (!Array.isArray(standing.rows)) continue;
    const available = standing.status === 'available';
    check(available ? sourceIds.has(standing.sourceId) && isHttpsUrl(standing.sourceUrl) : (standing.sourceId === null || sourceIds.has(standing.sourceId)) && (standing.sourceUrl === null || isHttpsUrl(standing.sourceUrl)), 'Invalid standings source.');
    check(available ? standing.rows.length > 0 : standing.rows.length === 0, 'Invalid standings row count.');
    const standingTeams = new Set(), positions = new Set();
    for (const row of standing.rows) {
      if (!isRecord(row)) { errors.push('Invalid standing row.'); continue; }
      check(teamIds.has(row.teamId) && !standingTeams.has(row.teamId), 'Invalid or duplicated team in standings.'); standingTeams.add(row.teamId);
      check(integer(row.position) && row.position >= 1 && integer(row.played) && integer(row.wins) && integer(row.losses), 'Invalid standings numbers.');
      check(!positions.has(row.position) && row.played === row.wins + row.losses, 'Invalid standings position or record.'); positions.add(row.position);
      check(row.points === null || (typeof row.points === 'number' && Number.isFinite(row.points)), 'Invalid standings points.');
    }
  }
  check(isRecord(data.coverage) && Array.isArray(data.coverage.teamIds) && (data.coverage.note === null || typeof data.coverage.note === 'string'), 'Invalid coverage.');
  if (isRecord(data.coverage) && Array.isArray(data.coverage.teamIds)) {
    const tracked = new Set(data.teams.filter(team => team.tracked).map(team => team.id));
    check(new Set(data.coverage.teamIds).size === data.coverage.teamIds.length && data.coverage.teamIds.every(id => tracked.has(id)), 'Invalid coverage team references.');
    if (data.mode !== 'empty') {
      check(data.coverage.teamIds.length > 0 && data.sources.length > 0, 'Sources and checked teams are required.');
      check(data.coverage.teamIds.length === tracked.size || nonempty(data.coverage.note), 'Partial coverage requires a note.');
    }
  }
  if (data.mode === 'empty') {
    check(['sources', 'teams', 'competitions', 'venues', 'matches', 'standings'].every(key => data[key].length === 0) && Array.isArray(data.coverage?.teamIds) && data.coverage.teamIds.length === 0, 'Empty snapshots must not contain records.');
  }
  return { ok: errors.length === 0, errors };
}

export function indexSnapshot(data) {
  return {
    teams: new Map(data.teams.map(item => [item.id, item])),
    competitions: new Map(data.competitions.map(item => [item.id, item])),
    venues: new Map(data.venues.map(item => [item.id, item])),
    sources: new Map(data.sources.map(item => [item.id, item])),
    tracked: data.teams.filter(team => team.tracked),
    covered: new Set(data.coverage.teamIds),
  };
}

export function dateKey(value = new Date(), timezone = TIMEZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = type => parts.find(part => part.type === type).value;
  return get('year') + '-' + get('month') + '-' + get('day');
}

export function isDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addDays(key, days) {
  const value = new Date(key + 'T12:00:00Z'); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10);
}

export function mondayOf(key) {
  const day = new Date(key + 'T12:00:00Z').getUTCDay(); return addDays(key, -((day + 6) % 7));
}

export function isoWeek(key) {
  const date = new Date(key + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const year = date.getUTCFullYear(), first = new Date(Date.UTC(year, 0, 1, 12));
  return { year, number: Math.ceil((((date - first) / 86400000) + 1) / 7) };
}

export function shortDate(key) {
  const date = new Date(key + 'T12:00:00Z'); return date.getUTCDate() + '.' + (date.getUTCMonth() + 1) + '.';
}

export function weekLabel(start) { return shortDate(start) + '–' + shortDate(addDays(start, 6)); }

export function dayLabel(key, short = false) {
  const date = new Date(key + 'T12:00:00Z');
  return new Intl.DateTimeFormat('fi-FI', { timeZone: 'UTC', weekday: short ? 'short' : 'long' }).format(date) + ' ' + shortDate(key);
}

export function timeLabel(instant) {
  return instant ? new Intl.DateTimeFormat('fi-FI', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(instant)) : 'Avoin';
}

export function fetchedLabel(instant) {
  return instant ? new Intl.DateTimeFormat('fi-FI', { timeZone: TIMEZONE, day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(instant)) : null;
}

export function freshness(data, now = new Date()) {
  if (data.mode !== 'live') return { stale: false, oldestFetch: null, latestFetch: null, generatedAt: data.generatedAt };
  const fetched = data.sources.map(source => Date.parse(source.fetchedAt)).filter(Number.isFinite);
  const generated = Date.parse(data.generatedAt), oldest = fetched.length ? Math.min(generated, ...fetched) : generated;
  return { stale: now.getTime() - oldest > STALE_AFTER_MS, oldestFetch: fetched.length ? new Date(Math.min(...fetched)).toISOString() : null, latestFetch: fetched.length ? new Date(Math.max(...fetched)).toISOString() : null, generatedAt: data.generatedAt };
}

export function mapUrl(venue) {
  if (!venue || !nonempty(venue.address)) return null;
  const components = [venue.name.trim(), venue.address.trim()];
  if (nonempty(venue.city) && !venue.address.toLocaleLowerCase('fi').includes(venue.city.trim().toLocaleLowerCase('fi'))) components.push(venue.city.trim());
  return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(components.join(', '));
}

export function matchesForCalendar(data, index, { week, place = 'joensuu', filter = 'all' }) {
  const end = addDays(week, 6), timed = [], undated = [];
  for (const match of data.matches) {
    const home = index.teams.get(match.homeTeamId), away = index.teams.get(match.awayTeamId);
    const venue = index.venues.get(match.venueId);
    if (place === 'joensuu' && venue?.city?.trim().toLocaleLowerCase('fi') !== 'joensuu') continue;
    if (filter === 'junior' && ![home, away].some(team => team?.tracked && team.category === 'junior')) continue;
    if (!['all', 'junior'].includes(filter) && ![match.homeTeamId, match.awayTeamId].includes(filter)) continue;
    if (!match.startsAt) { undated.push(match); continue; }
    const key = dateKey(match.startsAt);
    if (key >= week && key <= end) timed.push(match);
  }
  timed.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id));
  return { timed, undated };
}

export function isCovered(data, teamId) { return data.coverage.teamIds.includes(teamId); }

export function teamMatches(data, teamId, competitionId = null) {
  return data.matches.filter(match => [match.homeTeamId, match.awayTeamId].includes(teamId) && (!competitionId || match.competitionId === competitionId));
}

export function resultsForTeam(data, teamId, competitionId = null) {
  return teamMatches(data, teamId, competitionId).filter(match => match.status === 'final').sort((a, b) => (Date.parse(b.startsAt) || 0) - (Date.parse(a.startsAt) || 0)).slice(0, 5);
}

export function ownResult(match, teamId) {
  if (match.status !== 'final' || ![match.homeTeamId, match.awayTeamId].includes(teamId)) return null;
  const own = match.homeTeamId === teamId ? match.homeScore : match.awayScore;
  const opponent = match.homeTeamId === teamId ? match.awayScore : match.homeScore;
  return { own, opponent, result: own > opponent ? 'win' : own < opponent ? 'loss' : 'draw' };
}

export function upcomingForTeam(data, teamId, competitionId = null, now = new Date()) {
  return teamMatches(data, teamId, competitionId).filter(match => match.status !== 'final' && (!match.startsAt || Date.parse(match.startsAt) >= now.getTime()))
    .sort((a, b) => (a.startsAt ? Date.parse(a.startsAt) : Infinity) - (b.startsAt ? Date.parse(b.startsAt) : Infinity));
}

export function standingFor(data, teamId, competitionId) {
  const standing = data.standings.find(item => item.competitionId === competitionId);
  const own = standing?.status === 'available' ? standing.rows.find(row => row.teamId === teamId) : null;
  return { standing: standing || null, own: own || null };
}

export function parseRoute(hash) {
  const raw = (hash || '').replace(/^#/, ''), cut = raw.indexOf('?');
  const path = (cut === -1 ? raw : raw.slice(0, cut)).split('/').filter(Boolean);
  const params = new URLSearchParams(cut === -1 ? '' : raw.slice(cut + 1));
  let teamId = null, eventId = null;
  try {
    teamId = path[0] === 'joukkue' && path[1] ? decodeURIComponent(path[1]) : null;
    eventId = path[0] === 'tapahtuma' && path[1] ? decodeURIComponent(path[1]) : null;
  } catch { teamId = eventId = null; }
  return {
    view: eventId ? 'event' : path[0] === 'tapahtumat' ? 'events' : teamId ? 'detail' : path[0] === 'joukkueet' ? 'teams' : 'calendar',
    teamId, eventId,
    demo: params.get('demo') === '1',
    week: isDateKey(params.get('week')) ? mondayOf(params.get('week')) : null,
    place: params.get('place') === 'all' ? 'all' : 'joensuu',
    filter: params.get('filter') || 'all',
    competitionId: params.get('competition') || null,
    from: params.get('from') === 'teams' ? 'teams' : 'calendar',
  };
}

export function routeHash(route) {
  const path = route.view === 'event' && route.eventId ? '/tapahtuma/' + encodeURIComponent(route.eventId) : route.view === 'events' ? '/tapahtumat' : route.view === 'detail' && route.teamId ? '/joukkue/' + encodeURIComponent(route.teamId) : route.view === 'teams' ? '/joukkueet' : '/ottelut';
  const params = new URLSearchParams();
  if (route.demo) params.set('demo', '1');
  if (isDateKey(route.week)) params.set('week', route.week);
  if (route.place === 'all') params.set('place', 'all');
  if (route.filter && route.filter !== 'all') params.set('filter', route.filter);
  if (route.view === 'detail' && route.competitionId) params.set('competition', route.competitionId);
  if (route.view === 'detail' && route.from === 'teams') params.set('from', 'teams');
  const query = params.toString(); return '#' + path + (query ? '?' + query : '');
}
