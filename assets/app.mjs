import {
  TIMEZONE, validateSnapshot, indexSnapshot, dateKey, mondayOf, addDays, isoWeek,
  weekLabel, dayLabel, shortDate, timeLabel, fetchedLabel, freshness, mapUrl,
  matchesForCalendar, isCovered, resultsForTeam, ownResult, upcomingForTeam,
  standingFor, parseRoute, routeHash,
} from './core.mjs';
import { validateEvents, editorialDate, renderEventIndex, renderEventDetail } from './events.mjs';

const root = document.getElementById('kataja-scoreboard');
const $ = selector => root.querySelector(selector);
const views = ['status', 'calendar', 'teams', 'detail', 'events', 'event'];
let snapshot = null, index = null, loadedFile = null, loadToken = 0;
let eventContent = null;
if (!location.hash && document.documentElement.dataset.initialEvent) {
  replaceHash('#/tapahtuma/' + encodeURIComponent(document.documentElement.dataset.initialEvent));
}
let route = parseRoute(location.hash);

function el(tag, cls = '', text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function referenceNow() {
  return snapshot?.mode === 'demo' ? new Date(snapshot.generatedAt) : new Date();
}

function routeFor(changes = {}) { return { ...route, ...changes }; }
function linkTo(changes = {}) { return routeHash(routeFor(changes)); }
function replaceHash(hash) { const url = new URL(location.href); url.hash = hash; history.replaceState(null, '', url.href); }

function go(changes = {}, replace = false) {
  const next = routeFor(changes), hash = routeHash(next);
  if (replace) { replaceHash(hash); route = next; render(); }
  else if (location.hash === hash) { route = next; render(); }
  else location.hash = hash;
}

function showView(view) {
  for (const name of views) $('#ks-' + name + '-view').hidden = name !== view;
  const context = view === 'status' ? route.view : view;
  const selected = ['event', 'events'].includes(context) ? 'events' : ['teams', 'detail'].includes(context) ? 'teams' : 'calendar';
  for (const name of ['calendar', 'teams', 'events']) {
    const link = $('#ks-nav-' + name); link.toggleAttribute('data-active', name === selected);
    if (name === selected) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  }
}

function showStatus(title, message, { demo = false, retry = false, back = false } = {}) {
  showView('status'); $('#ks-status-title').textContent = title; $('#ks-status-message').textContent = message;
  $('#ks-demo-button').hidden = !demo; $('#ks-retry-button').hidden = !retry;
  let backLink = $('#ks-return-calendar');
  if (!backLink) { backLink = el('a', 'ks-secondary', 'Takaisin otteluihin'); backLink.id = 'ks-return-calendar'; $('.ks-status-actions').append(backLink); }
  backLink.hidden = !back; backLink.href = linkTo({ view: 'calendar', teamId: null, competitionId: null });
}

function normaliseRoute(next) {
  const result = { ...next };
  result.week ||= mondayOf(dateKey(referenceNow()));
  if (!['all', 'junior'].includes(result.filter) && !index.tracked.some(team => team.id === result.filter)) result.filter = 'all';
  const team = index.teams.get(result.teamId);
  if (result.view === 'detail' && team?.tracked) {
    if (!team.competitionIds.includes(result.competitionId)) result.competitionId = team.competitionIds[0] || null;
  }
  return result;
}

async function loadRoute(force = false) {
  const next = parseRoute(location.hash), file = next.demo ? 'demo' : 'latest';
  const token = ++loadToken;
  if (['events', 'event'].includes(next.view)) { route = next; await loadEditorialRoute(force, token); return; }
  if (snapshot && loadedFile === file && !force) { route = normaliseRoute(next); replaceHash(routeHash(route)); render(); return; }
  route = next;
  showStatus('Ladataan ottelutietoja', 'Haetaan viimeisintä viikoittaista koostetta.');
  $('#ks-demo-banner').hidden = !next.demo;
  $('#ks-data-status').replaceChildren();
  try {
    const response = await fetch(new URL('../data/' + file + '.json', import.meta.url), { cache: 'no-cache', credentials: 'omit' });
    if (!response.ok) throw new Error('Snapshot HTTP ' + response.status);
    const data = await response.json();
    const validation = validateSnapshot(data);
    if (!validation.ok) throw new Error('Snapshot validation failed: ' + validation.errors.join(' '));
    if (file === 'demo' ? data.mode !== 'demo' : data.mode === 'demo') throw new Error('Dataset mode does not match the requested file.');
    if (token !== loadToken) return;
    snapshot = data; index = indexSnapshot(data); loadedFile = file;
    route = normaliseRoute(next); replaceHash(routeHash(route));
    renderOptions(); render();
  } catch (error) {
    if (token !== loadToken) return;
    console.error('Otteluaineistoa ei voitu ladata:', error.message);
    snapshot = null; index = null; loadedFile = null;
    showStatus('Ottelutietoja ei voitu ladata', 'Viikoittainen datatiedosto ei ole juuri nyt saatavilla tai sitä ei voitu varmistaa. Voit yrittää uudelleen tai katsoa kuvitteellista esimerkkiä.', { demo: true, retry: true });
    $('#ks-footer-status').textContent = 'Ottelutietojen lataaminen ei onnistunut.';
  }
}

function renderOptions() {
  const filter = $('#ks-team-filter'), picker = $('#ks-detail-team');
  filter.replaceChildren(); picker.replaceChildren();
  for (const [value, name] of [['all', 'Kaikki joukkueet'], ['junior', 'Juniorit']]) { const option = el('option', '', name); option.value = value; filter.append(option); }
  for (const team of index.tracked) {
    for (const select of [filter, picker]) { const option = el('option', '', team.name); option.value = team.id; select.append(option); }
  }
}

function updateChrome() {
  const demo = snapshot.mode === 'demo', empty = snapshot.mode === 'empty';
  $('#ks-demo-banner').hidden = !demo;
  $('#ks-nav-calendar').href = linkTo({ view: 'calendar', teamId: null, competitionId: null });
  $('#ks-nav-teams').href = linkTo({ view: 'teams', teamId: null, competitionId: null });
  $('#ks-nav-events').href = linkTo({ view: 'events', eventId: null, teamId: null, competitionId: null });
  const status = $('#ks-data-status'); status.replaceChildren(); status.classList.remove('ks-data-stale'); status.hidden = empty;
  if (demo) {
    status.append(el('span', '', 'Kuvitteellinen esimerkkiaineisto. Maps-linkit käyttävät oikeaa pelipaikkaa.'));
    $('#ks-footer-status').textContent = 'Demotila · esimerkkiaineisto ei ole seuran otteluohjelma.';
  } else if (!empty) {
    const age = freshness(snapshot), text = age.latestFetch ? 'Viimeisin lähdehaku ' + fetchedLabel(age.latestFetch) : 'Kooste muodostettu ' + fetchedLabel(snapshot.generatedAt);
    status.append(el('span', '', text + ' · viikoittainen kooste'));
    if (age.stale) { status.classList.add('ks-data-stale'); status.append(el('strong', '', 'Kooste tai osa lähdetiedoista on yli 8 päivää vanhoja. Tarkista mahdolliset muutokset ottelun lähteestä.')); }
    $('#ks-footer-status').textContent = 'Kooste muodostettu ' + fetchedLabel(snapshot.generatedAt) + '.';
  } else $('#ks-footer-status').textContent = 'Ottelutiedot odottavat ensimmäistä onnistunutta hakua.';
}

async function loadEditorialRoute(force, token) {
  $('#ks-demo-banner').hidden = true;
  $('#ks-data-status').hidden = false;
  $('#ks-data-status').classList.remove('ks-data-stale');
  $('#ks-data-status').textContent = 'Tapahtumasivut · toimituksellinen, lähteisiin perustuva kooste';
  if (eventContent && !force) { renderEditorial(); return; }
  showStatus('Ladataan tapahtumatietoja', 'Haetaan turnausten esittelyt, vahvistetut tiedot ja historia.');
  try {
    const response = await fetch(new URL('../data/events.json', import.meta.url), { cache: 'no-cache', credentials: 'omit' });
    if (!response.ok) throw new Error('Events HTTP ' + response.status);
    const data = await response.json(), validation = validateEvents(data);
    if (!validation.ok) throw new Error('Event validation failed: ' + validation.errors.join(' '));
    if (token !== loadToken) return;
    eventContent = data; renderEditorial();
  } catch (error) {
    if (token !== loadToken) return;
    console.error('Tapahtumatietoja ei voitu ladata:', error.message);
    showStatus('Tapahtumatietoja ei voitu ladata', 'Tapahtumien sisältötiedosto ei ole juuri nyt saatavilla tai sen tietoja ei voitu varmistaa.', { retry: true, back: true });
    $('#ks-footer-status').textContent = 'Tapahtumatietojen lataaminen ei onnistunut.';
  }
}

function renderEditorial() {
  if (!eventContent) return;
  $('#ks-demo-banner').hidden = true;
  $('#ks-data-status').hidden = false;
  $('#ks-data-status').classList.remove('ks-data-stale');
  $('#ks-data-status').textContent = 'Tapahtumien sisältö päivitetty ' + editorialDate(eventContent.updatedAt) + ' · toimituksellinen kooste';
  $('#ks-footer-status').textContent = 'Tapahtumien tiedot ja historia perustuvat sivuilla mainittuihin lähteisiin.';
  $('#ks-nav-calendar').href = linkTo({ view: 'calendar', eventId: null, teamId: null, competitionId: null });
  $('#ks-nav-teams').href = linkTo({ view: 'teams', eventId: null, teamId: null, competitionId: null });
  $('#ks-nav-events').href = linkTo({ view: 'events', eventId: null, teamId: null, competitionId: null });
  if (route.view === 'event') {
    const found = renderEventDetail($('#ks-event-view'), eventContent, route.eventId, linkTo({ view: 'events', eventId: null }));
    if (!found) { showStatus('Tapahtumaa ei löydy', 'Tässä osoitteessa ei ole julkaistua tapahtumasivua.', { back: true }); return; }
    showView('event');
    const name = eventContent.events.find(event => event.id === route.eventId).title;
    document.title = name + ' – Kataja Basket Community'; $('#ks-announcement').textContent = name + ', tapahtumasivu.';
  } else {
    renderEventIndex($('#ks-events-view'), eventContent, id => new URL('../tapahtumat/' + encodeURIComponent(id) + '/', import.meta.url).href);
    showView('events'); document.title = 'Tapahtumat – Kataja Basket Community'; $('#ks-announcement').textContent = 'Koripallotapahtumat.';
  }
}

function competitionLabel(competition) {
  if (!competition) return 'Sarjatieto puuttuu';
  return [competition.name, competition.season, competition.phase].filter(Boolean).join(' · ');
}

function venueLabel(match) {
  const venue = index.venues.get(match.venueId);
  return venue ? [venue.name, venue.city].filter(Boolean).join(' · ') : 'Pelipaikka vahvistamatta';
}

function mapLink(match) {
  const venue = index.venues.get(match.venueId), url = mapUrl(venue);
  if (!url || match.status === 'cancelled') return null;
  const link = el('a', 'ks-map cursor-interaction', 'Maps ↗');
  link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
  link.setAttribute('aria-label', 'Reittiohje Google Mapsissa: ' + [venue.name, venue.address].filter(Boolean).join(', '));
  return link;
}

function appendSource(parent, record, { compact = false } = {}) {
  if (snapshot.mode === 'demo' || !record.sourceId || !record.sourceUrl) return;
  const source = index.sources.get(record.sourceId);
  if (!source) return;
  const line = el('div', 'ks-source-meta');
  const link = el('a', '', (compact ? 'Ottelun lähde' : source.label) + ' ↗');
  link.href = record.sourceUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; line.append(link);
  line.append(el('span', '', ' · haettu ' + fetchedLabel(source.fetchedAt))); parent.append(line);
}

function primaryTeam(match) {
  if (![ 'all', 'junior' ].includes(route.filter) && [match.homeTeamId, match.awayTeamId].includes(route.filter)) return index.teams.get(route.filter);
  return [index.teams.get(match.homeTeamId), index.teams.get(match.awayTeamId)].find(team => team?.tracked) || null;
}

function teamHref(teamId, from = route.view === 'teams' ? 'teams' : 'calendar') {
  return linkTo({ view: 'detail', teamId, competitionId: null, from });
}

function matchTitle(match) {
  return index.teams.get(match.homeTeamId).shortName + ' – ' + index.teams.get(match.awayTeamId).shortName;
}

function appendMatchNames(parent, match, clickable = true) {
  for (const [offset, id] of [match.homeTeamId, match.awayTeamId].entries()) {
    if (offset) parent.append(document.createTextNode(' – '));
    const team = index.teams.get(id);
    if (clickable && team.tracked) { const link = el('a', 'ks-team-name', team.shortName); link.href = teamHref(team.id); parent.append(link); }
    else parent.append(el('span', '', team.shortName));
  }
}

function statusLabel(match) {
  return { scheduled: null, final: 'Lopputulos', postponed: 'Siirretty', cancelled: 'Peruttu', 'time-tbc': 'Aika vahvistamatta' }[match.status];
}

function gameCard(match) {
  const row = el('article', 'ks-game' + (match.status === 'cancelled' ? ' ks-cancelled' : ''));
  const own = primaryTeam(match), time = el('div', 'ks-time', timeLabel(match.startsAt));
  time.append(el('small', '', own ? (match.homeTeamId === own.id ? 'KOTI' : 'VIERAS') : 'OTTELU')); row.append(time);
  const info = el('div', 'ks-game-info');
  info.append(el('div', 'ks-category', own?.name || index.competitions.get(match.competitionId).name));
  const name = el('h3', 'ks-game-match'); appendMatchNames(name, match); info.append(name);
  info.append(el('div', 'ks-place', venueLabel(match)));
  if (match.status === 'final') info.append(el('span', 'ks-status-tag', 'Lopputulos ' + match.homeScore + '–' + match.awayScore + ' · koti–vieras'));
  else if (statusLabel(match)) info.append(el('span', 'ks-status-tag' + (match.status === 'cancelled' || match.status === 'postponed' ? ' ks-status-warning' : ''), statusLabel(match)));
  appendSource(info, match, { compact: true }); row.append(info);
  const map = mapLink(match); if (map) row.append(map);
  return row;
}

function filterCoverageIds() {
  return index.tracked.filter(team => route.filter === 'all' || (route.filter === 'junior' && team.category === 'junior') || route.filter === team.id).map(team => team.id);
}

function emptyCalendarText() {
  const relevant = filterCoverageIds(), unchecked = relevant.filter(id => !index.covered.has(id));
  if (unchecked.length) return 'Valittujen joukkueiden tietoja ei ole tarkistettu kattavasti tässä haussa. Tyhjä lista ei tarkoita, ettei pelejä olisi.';
  return 'Haetussa aineistossa ei ole tälle viikolle ja rajaukselle ajoitettuja otteluita.';
}

function renderCoverage() {
  const banner = $('#ks-coverage'); banner.replaceChildren();
  const partial = index.covered.size < index.tracked.length;
  banner.hidden = snapshot.mode === 'demo' || (!partial && !snapshot.coverage.note);
  if (!banner.hidden) {
    banner.append(el('strong', '', 'Tässä haussa tarkistettu ' + index.covered.size + ' / ' + index.tracked.length + ' seurattua joukkuetta.'));
    if (snapshot.coverage.note) banner.append(el('span', '', snapshot.coverage.note));
    if (partial) banner.append(el('span', '', 'Muiden joukkueiden puuttuvat tiedot eivät tarkoita, ettei niillä olisi otteluita.'));
  }
}

function renderCalendar() {
  showView('calendar'); const currentWeek = mondayOf(dateKey(referenceNow())), w = isoWeek(route.week);
  $('#ks-week-label').textContent = weekLabel(route.week);
  $('#ks-week-number').textContent = (snapshot.mode === 'demo' ? 'Esimerkkiviikko ' : 'Viikko ') + w.number + ' · ' + w.year;
  $('#ks-this-week').hidden = route.week === currentWeek;
  $('#ks-this-week').textContent = snapshot.mode === 'demo' ? 'Esimerkkiviikkoon' : 'Tähän viikkoon';
  $('#ks-team-filter').value = route.filter;
  root.querySelectorAll('[data-ks-location]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.ksLocation === route.place)));
  const { timed, undated } = matchesForCalendar(snapshot, index, route);
  $('#ks-list-meta').textContent = timed.length + ' ajoitettua ottelua' + (route.place === 'joensuu' ? ' Joensuussa' : '') + (undated.length ? ' · ' + undated.length + ' ilman vahvistettua päivää' : '');
  const list = $('#ks-games'); list.replaceChildren(); let previousDay = null;
  for (const match of timed) {
    const key = dateKey(match.startsAt);
    if (key !== previousDay) { const heading = el('div', 'ks-day-header'); heading.append(el('h2', '', dayLabel(key))); list.append(heading); previousDay = key; }
    list.append(gameCard(match));
  }
  if (!timed.length) list.append(el('p', 'ks-empty', emptyCalendarText()));
  if (undated.length) { const heading = el('div', 'ks-day-header'); heading.append(el('h2', '', 'Päivä vahvistamatta')); list.append(heading); list.append(el('p', 'ks-undated-note', 'Näitä otteluita ei ole kohdistettu valittuun viikkoon.')); for (const match of undated) list.append(gameCard(match)); }
  if (route.place === 'joensuu') {
    const anyPlace = matchesForCalendar(snapshot, index, { ...route, place: 'all' });
    const missing = [...anyPlace.timed, ...anyPlace.undated].filter(match => !index.venues.get(match.venueId)?.city?.trim());
    if (missing.length) { const note = el('p', 'ks-list-note', missing.length + ' ottelun paikkakunta puuttuu. '); const link = el('a', '', 'Näytä kaikki paikat →'); link.href = linkTo({ place: 'all' }); note.append(link); list.append(note); }
  }
  renderCoverage(); renderTeamChoices();
  $('#ks-announcement').textContent = 'Ottelut, viikko ' + w.number + ', ' + timed.length + ' ajoitettua ottelua.';
}

function teamOverview(team) {
  if (!isCovered(snapshot, team.id)) return 'Ei tarkistettu tässä haussa';
  if (team.competitionIds.length !== 1) return team.competitionIds.length ? team.competitionIds.length + ' sarjaa' : 'Sarjatieto puuttuu';
  const { own } = standingFor(snapshot, team.id, team.competitionIds[0]);
  return own ? own.position + '. sija · ' + own.wins + ' V / ' + own.losses + ' T' : 'Sarjatilannetta ei saatavilla';
}

function teamInitials(team) {
  const under = team.name.match(/U(\d+)/i); if (under) return under[1];
  return team.shortName.split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase();
}

function renderTeamChoices() {
  const rail = $('#ks-team-rail'), grid = $('#ks-team-grid'); rail.replaceChildren(); grid.replaceChildren();
  for (const team of index.tracked) {
    const mini = el('a', 'ks-mini-team cursor-interaction'); mini.href = teamHref(team.id, 'calendar'); mini.dataset.ksTeam = team.id;
    mini.append(el('span', 'ks-small-mark', teamInitials(team))); const words = el('span'); words.append(el('span', 'ks-mini-name', team.name), el('span', 'ks-mini-meta', teamOverview(team))); mini.append(words, el('span', 'ks-mini-arrow', '→')); rail.append(mini);
    const card = el('a', 'ks-team-card cursor-interaction'); card.href = teamHref(team.id, 'teams'); card.dataset.ksTeam = team.id;
    const top = el('div', 'ks-team-card-top'); top.append(el('span', 'ks-small-mark', teamInitials(team))); const title = el('div'); title.append(el('h2', '', team.name), el('p', 'ks-team-card-sub', team.category === 'junior' ? 'Juniorit' : 'Aikuiset')); top.append(title); card.append(top);
    const bottom = el('div', 'ks-team-card-bottom'); bottom.append(el('span', '', teamOverview(team)), el('span', '', 'Avaa joukkue →')); card.append(bottom); grid.append(card);
  }
}

function renderTeams() {
  showView('teams'); renderTeamChoices(); $('#ks-announcement').textContent = index.tracked.length + ' seurattua joukkuetta.';
}

function competitionOptions(team) {
  const picker = $('#ks-competition'); picker.replaceChildren();
  for (const id of team.competitionIds) { const competition = index.competitions.get(id), option = el('option', '', competitionLabel(competition)); option.value = id; picker.append(option); }
  picker.value = route.competitionId || ''; $('#ks-competition-field').hidden = team.competitionIds.length < 2;
}

function renderTeamHeader(team, competition, own, standing) {
  const parent = $('#ks-team-header'); parent.replaceChildren(); const head = el('div', 'ks-team-head'), identity = el('div');
  identity.append(el('div', 'ks-overline', 'Kataja Basket' + (competition?.season ? ' · kausi ' + competition.season : '')), el('h1', 'ks-page-title', team.name), el('p', 'ks-page-intro', competitionLabel(competition))); head.append(identity);
  if (own) {
    const stats = el('div', 'ks-team-stats');
    for (const [value, label] of [[own.position + '.', 'sija / ' + standing.rows.length + ' joukkuetta'], [own.wins + '–' + own.losses, 'voitot – tappiot']]) { const item = el('div'); item.append(el('div', 'ks-team-stat-value', value), el('div', 'ks-team-stat-label', label)); stats.append(item); }
    head.append(stats);
  }
  parent.append(head);
}

function renderNextGame(team, upcoming) {
  const parent = $('#ks-next-game'); parent.replaceChildren();
  const confirmed = upcoming.find(match => match.status === 'scheduled' && match.startsAt);
  const game = confirmed || upcoming.find(match => ['scheduled', 'time-tbc'].includes(match.status));
  if (!game) {
    const message = isCovered(snapshot, team.id) ? 'Haetussa aineistossa ei ole seuraavaa vahvistettua ottelua tähän sarjaan.' : 'Joukkueen ottelutiedot eivät sisälly kattavasti tähän hakuun.';
    const box = el('div', 'ks-next-empty'); box.append(el('h2', '', 'Seuraava ottelu'), el('p', '', message)); parent.append(box); return null;
  }
  const box = el('article', 'ks-next'), left = el('div'), venue = index.venues.get(game.venueId);
  left.append(el('div', 'ks-overline', 'Seuraava ottelu · ' + (game.homeTeamId === team.id ? 'kotipeli' : 'vieraspeli')), el('h2', '', matchTitle(game)), el('p', 'ks-next-meta', venue ? [venue.name, venue.address || venue.city].filter(Boolean).join(' · ') : 'Pelipaikka vahvistamatta'));
  if (statusLabel(game)) left.append(el('p', 'ks-next-meta', statusLabel(game)));
  appendSource(left, game, { compact: true }); box.append(left);
  const right = el('div', 'ks-next-right'); right.append(el('div', 'ks-next-time', timeLabel(game.startsAt)), el('div', 'ks-next-day', game.startsAt ? dayLabel(dateKey(game.startsAt), true) : 'Päivä vahvistamatta')); const map = mapLink(game); if (map) right.append(map); box.append(right); parent.append(box); return game;
}

function renderStandings(team, standing, own) {
  const panel = $('#ks-standings-panel'); panel.replaceChildren(); const heading = el('div', 'ks-panel-heading'); heading.append(el('h2', '', 'Sarjatilanne'));
  const available = standing?.status === 'available';
  heading.append(el('p', '', available ? standing.rows.length + ' joukkuetta' : standing?.status === 'not-published' ? 'Tässä sarjassa taulukkoa ei julkaista' : 'Taulukkoa ei ole saatu tähän aineistoon')); panel.append(heading);
  if (!available || !standing.rows.length) {
    panel.append(el('p', 'ks-panel-empty', standing?.status === 'not-published' ? 'Sarjataulukkoa ei ole julkaistu lähteessä.' : 'Sarjatilanne ei ole saatavilla. Puuttuvista tiedoista ei ole muodostettu sijoituksia.'));
    if (standing) appendSource(panel, standing); return;
  }
  const table = el('table', 'ks-standings'); table.setAttribute('aria-label', team.name + ', sarjataulukko');
  const head = el('thead'), header = el('tr');
  for (const [label, full] of [['#', 'Sijoitus'], ['Joukkue', 'Joukkue'], ['O', 'Ottelut'], ['V', 'Voitot'], ['T', 'Tappiot']]) { const th = el('th', '', label); th.scope = 'col'; th.setAttribute('aria-label', full); header.append(th); }
  head.append(header); table.append(head); const body = el('tbody');
  for (const row of [...standing.rows].sort((a, b) => a.position - b.position)) {
    const ownRow = row.teamId === team.id, tr = el('tr', ownRow ? 'ks-own-row' : '');
    for (const value of [row.position, index.teams.get(row.teamId).shortName, row.played, row.wins, row.losses]) tr.append(el('td', '', value));
    body.append(tr);
  }
  table.append(body); panel.append(table, el('p', 'ks-table-note', 'O = ottelut · V = voitot · T = tappiot'));
  if (!own) panel.append(el('p', 'ks-panel-empty', 'Joukkueen oma rivi puuttuu tästä taulukosta.'));
  appendSource(panel, standing);
}

function renderResults(team) {
  const panel = $('#ks-results-panel'); panel.replaceChildren(); const heading = el('div', 'ks-panel-heading');
  heading.append(el('h2', '', 'Viimeiset 5 ottelua'), el('p', '', 'Uusin ensin · tämän joukkueen pisteet aina ensin')); panel.append(heading);
  const results = resultsForTeam(snapshot, team.id, route.competitionId);
  if (!results.length) panel.append(el('p', 'ks-panel-empty', isCovered(snapshot, team.id) ? 'Haetussa aineistossa ei ole tämän sarjan lopputuloksia.' : 'Tämän joukkueen tuloksia ei ole tarkistettu kattavasti tässä haussa.'));
  for (const match of results) {
    const result = ownResult(match, team.id), home = match.homeTeamId === team.id;
    const row = el('div', 'ks-result'), left = el('div'), opponent = index.teams.get(home ? match.awayTeamId : match.homeTeamId);
    left.append(el('div', 'ks-result-name', 'vs. ' + opponent.shortName), el('div', 'ks-result-meta', (match.startsAt ? dayLabel(dateKey(match.startsAt), true) : 'Päivä puuttuu') + ' · ' + (home ? 'Koti' : 'Vieras')));
    appendSource(left, match, { compact: true }); row.append(left); const right = el('div', 'ks-result-right');
    right.append(el('div', 'ks-score', result.own + '–' + result.opponent));
    const label = result.result === 'win' ? 'V · Voitto' : result.result === 'loss' ? 'T · Tappio' : 'Tasatulos';
    right.append(el('div', 'ks-result-label ' + (result.result === 'win' ? 'ks-result-win' : result.result === 'loss' ? 'ks-result-loss' : 'ks-result-draw'), label)); row.append(right); panel.append(row);
  }
}

function renderUpcoming(team, upcoming, first) {
  const parent = $('#ks-upcoming'); parent.replaceChildren(); parent.append(el('h2', 'ks-upcoming-heading', 'Myöhemmin ohjelmassa'));
  const following = upcoming.filter(match => match.id !== first?.id).slice(0, 3);
  if (!following.length) parent.append(el('p', 'ks-panel-empty', isCovered(snapshot, team.id) ? 'Haetussa aineistossa ei ole muita tulevia pelejä tähän sarjaan.' : 'Lisää pelejä voi puuttua tämän haun ulkopuolelle jääneeltä joukkueelta.'));
  for (const match of following) {
    const row = el('article', 'ks-upcoming-row' + (match.status === 'cancelled' ? ' ks-cancelled' : '')), date = el('div', 'ks-upcoming-date', match.startsAt ? dayLabel(dateKey(match.startsAt), true) : 'Päivä avoin');
    date.append(el('small', '', match.startsAt ? 'klo ' + timeLabel(match.startsAt) : 'Aika vahvistamatta')); row.append(date);
    const info = el('div'); info.append(el('div', 'ks-upcoming-name', matchTitle(match)), el('div', 'ks-upcoming-place', venueLabel(match)));
    if (statusLabel(match)) info.append(el('span', 'ks-status-tag ks-status-warning', statusLabel(match)));
    appendSource(info, match, { compact: true }); row.append(info); const map = mapLink(match); if (map) row.append(map); parent.append(row);
  }
  const calendar = el('a', 'ks-team-calendar-link', 'Joukkueen ottelukalenteriin →'); calendar.href = linkTo({ view: 'calendar', teamId: null, competitionId: null, filter: team.id, place: 'all' }); parent.append(calendar);
}

function renderDetail() {
  const team = index.teams.get(route.teamId);
  if (!team?.tracked) { showStatus('Joukkuetta ei löydy tästä aineistosta', 'Joukkueen osoite on voinut muuttua tai sen tietoja ei ole vielä lisätty.', { back: true }); return; }
  showView('detail'); $('#ks-detail-team').value = team.id;
  $('#ks-back').textContent = route.from === 'teams' ? '← Takaisin joukkueisiin' : '← Takaisin otteluihin';
  $('#ks-back').href = linkTo({ view: route.from, teamId: null, competitionId: null });
  competitionOptions(team); const competition = index.competitions.get(route.competitionId), { standing, own } = standingFor(snapshot, team.id, route.competitionId);
  renderTeamHeader(team, competition, own, standing);
  const notice = $('#ks-team-coverage'); notice.hidden = isCovered(snapshot, team.id); notice.textContent = 'Tämän joukkueen tietoja ei ole tarkistettu kattavasti tässä haussa. Puuttuvista otteluista tai tuloksista ei voi päätellä, ettei niitä olisi.';
  const upcoming = upcomingForTeam(snapshot, team.id, route.competitionId, referenceNow()), next = renderNextGame(team, upcoming);
  renderStandings(team, standing, own); renderResults(team); renderUpcoming(team, upcoming, next);
  $('#ks-announcement').textContent = team.name + ', joukkuesivu.';
}

function render() {
  if (['events', 'event'].includes(route.view)) { renderEditorial(); return; }
  if (!snapshot || !index) return;
  document.title = route.view === 'detail' && index.teams.has(route.teamId) ? index.teams.get(route.teamId).name + ' – Kataja Basket Community' : route.view === 'teams' ? 'Joukkueet – Kataja Basket Community' : 'Ottelut – Kataja Basket Community';
  updateChrome();
  if (snapshot.mode === 'empty') {
    showStatus('Ottelutiedot odottavat ensimmäistä hakua', 'Kalenteri täyttyy ensimmäisen onnistuneen viikoittaisen haun jälkeen. Voit sillä välin tutustua kuvitteelliseen esimerkkiin.', { demo: true }); return;
  }
  if (route.view === 'detail') renderDetail(); else if (route.view === 'teams') renderTeams(); else renderCalendar();
}

$('#ks-demo-button').addEventListener('click', () => go({ view: 'calendar', demo: true, week: null, filter: 'all', place: 'joensuu', teamId: null, competitionId: null }));
$('#ks-exit-demo').addEventListener('click', () => go({ view: 'calendar', demo: false, week: null, filter: 'all', place: 'joensuu', teamId: null, competitionId: null }));
$('#ks-retry-button').addEventListener('click', () => loadRoute(true));
$('#ks-prev').addEventListener('click', () => go({ week: addDays(route.week, -7) }, true));
$('#ks-next').addEventListener('click', () => go({ week: addDays(route.week, 7) }, true));
$('#ks-this-week').addEventListener('click', () => go({ week: mondayOf(dateKey(referenceNow())) }, true));
$('#ks-team-filter').addEventListener('change', event => go({ filter: event.target.value }, true));
$('#ks-detail-team').addEventListener('change', event => go({ teamId: event.target.value, competitionId: index.teams.get(event.target.value)?.competitionIds[0] || null }, true));
$('#ks-competition').addEventListener('change', event => go({ competitionId: event.target.value }, true));
root.querySelectorAll('[data-ks-location]').forEach(button => button.addEventListener('click', () => go({ place: button.dataset.ksLocation }, true)));
window.addEventListener('hashchange', () => loadRoute());
loadRoute();
