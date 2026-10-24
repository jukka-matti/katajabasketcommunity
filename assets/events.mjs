import { isHttpsUrl, isZonedInstant, isDateKey, fetchedLabel, mapUrl } from './core.mjs';

const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const date = value => isZonedInstant(value) || isDateKey(value);
const nullableText = value => value === null || nonempty(value);
const statuses = new Set(['unconfirmed', 'announced', 'registration-open', 'completed', 'cancelled']);

export function validateEvents(data) {
  const errors = [], check = (value, message) => { if (!value) errors.push(message); };
  if (!record(data)) return { ok: false, errors: ['Event content must be an object.'] };
  check(data.schemaVersion === 1 && date(data.updatedAt), 'Invalid event version or updatedAt.');
  check(Array.isArray(data.sources) && Array.isArray(data.events), 'Event arrays are required.');
  if (errors.length) return { ok: false, errors };
  const sourceIds = new Set(), eventIds = new Set();
  for (const source of data.sources) {
    if (!record(source)) { errors.push('Invalid event source.'); continue; }
    check(nonempty(source.id) && !sourceIds.has(source.id) && nonempty(source.label) && isHttpsUrl(source.url) && date(source.checkedAt), 'Invalid or duplicate event source.');
    sourceIds.add(source.id);
  }
  const refs = value => Array.isArray(value) && new Set(value).size === value.length && value.every(id => sourceIds.has(id));
  for (const event of data.events) {
    if (!record(event)) { errors.push('Invalid event.'); continue; }
    check(nonempty(event.id) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(event.id) && !eventIds.has(event.id), 'Invalid event id.'); eventIds.add(event.id);
    check([event.title, event.eyebrow, event.summary, event.seasonLabel].every(nonempty), 'Invalid event title or summary.');
    check(Array.isArray(event.description) && event.description.every(nonempty) && refs(event.sourceIds), 'Invalid event description or references.');
    const edition = event.currentEdition;
    if (!record(edition)) { errors.push('Event edition is required.'); continue; }
    check((edition.year === null || Number.isInteger(edition.year)) && statuses.has(edition.status) && nullableText(edition.dateLabel), 'Invalid event edition metadata.');
    check(edition.venue === null || (record(edition.venue) && nonempty(edition.venue.name) && nullableText(edition.venue.city) && nullableText(edition.venue.address)), 'Invalid event venue.');
    check([edition.registrationUrl, edition.scheduleUrl].every(value => value === null || isHttpsUrl(value)) && refs(edition.sourceIds), 'Invalid edition links or references.');
    check(Array.isArray(edition.teams) && edition.teams.every(team => record(team) && nonempty(team.name) && nullableText(team.division)), 'Invalid event teams.');
    check(Array.isArray(edition.schedule) && edition.schedule.every(item => record(item) && nullableText(item.time) && nonempty(item.label) && nullableText(item.court)), 'Invalid event schedule.');
    check(Array.isArray(edition.winners) && edition.winners.every(item => record(item) && nonempty(item.division) && nonempty(item.team)), 'Invalid event winners.');
    check(Array.isArray(event.history) && event.history.every(item => record(item) && (Number.isInteger(item.year) || nonempty(item.year)) && nonempty(item.title) && nonempty(item.text) && refs(item.sourceIds)), 'Invalid event history.');
  }
  return { ok: errors.length === 0, errors };
}

function el(tag, cls = '', text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function externalLink(url, label, cls = '') {
  const link = el('a', cls, label); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
}

export function editorialDate(value) {
  if (isZonedInstant(value)) return fetchedLabel(value);
  return new Intl.DateTimeFormat('fi-FI', { timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(value + 'T12:00:00Z'));
}

function statusLabel(status) {
  return { unconfirmed: 'Tiedot vahvistamatta', announced: 'Julkistettu', 'registration-open': 'Ilmoittautuminen avoinna', completed: 'Pelattu', cancelled: 'Peruttu' }[status];
}

function sourceRefs(parent, ids, data) {
  if (!ids.length) return;
  const line = el('div', 'ks-source-meta', ids.length === 1 ? 'Lähde: ' : 'Lähteet: ');
  for (const [i, id] of ids.entries()) {
    const source = data.sources.find(item => item.id === id);
    if (i) line.append(document.createTextNode(' · '));
    line.append(externalLink(source.url, source.label + ' ↗'));
  }
  parent.append(line);
}

function sourceSection(parent, ids, data) {
  if (!ids.length) return;
  const section = el('section', 'ks-event-sources'); section.append(el('h2', '', 'Lähteet ja tietojen tarkistus'));
  const list = el('ul');
  for (const id of [...new Set(ids)]) {
    const source = data.sources.find(item => item.id === id), item = el('li');
    item.append(externalLink(source.url, source.label + ' ↗'), document.createTextNode(' · tarkistettu ' + editorialDate(source.checkedAt))); list.append(item);
  }
  section.append(list); parent.append(section);
}

export function renderEventIndex(parent, data, hrefFor) {
  parent.replaceChildren();
  parent.append(el('div', 'ks-overline', 'Joensuun koripallotapahtumat'), el('h1', 'ks-page-title', 'Koris kokoaa yhteen.'), el('p', 'ks-page-intro', 'Tutustu tapahtumiin, löydä turnaustiedot ja palaa aiempien vuosien tunnelmiin.'));
  const grid = el('div', 'ks-events-grid');
  for (const event of data.events) {
    const card = el('a', 'ks-event-card'); card.href = hrefFor(event.id);
    card.append(el('span', 'ks-event-badge', event.seasonLabel), el('h2', '', event.title), el('p', '', event.summary));
    const edition = event.currentEdition;
    card.append(el('span', 'ks-mini-meta', (edition.year ? edition.year + ' · ' : '') + statusLabel(edition.status)), el('span', 'ks-event-card-link', 'Tutustu tapahtumaan →')); grid.append(card);
  }
  parent.append(grid);
  sourceSection(parent, data.events.flatMap(event => event.sourceIds), data);
}

function editionPanel(title, items, empty, itemBuilder) {
  const panel = el('section', 'ks-edition-panel'); panel.append(el('h3', '', title));
  if (!items.length) panel.append(el('p', 'ks-event-missing', empty));
  else { const list = el('ul', 'ks-event-list'); for (const item of items) list.append(itemBuilder(item)); panel.append(list); }
  return panel;
}

function currentEdition(parent, event, data) {
  const edition = event.currentEdition, section = el('section', 'ks-event-section');
  section.append(el('h2', '', edition.year ? 'Vuoden ' + edition.year + ' turnaus' : 'Seuraava turnaus'));
  const card = el('div', 'ks-edition-card'), heading = el('div', 'ks-edition-heading');
  heading.append(el('h3', '', edition.dateLabel || 'Ajankohta vahvistamatta'), el('span', 'ks-event-badge', statusLabel(edition.status))); card.append(heading);
  const notice = {
    unconfirmed: 'Seuraavan tapahtuman ajankohtaa ja osallistumistietoja ei ole vielä vahvistettu tähän koosteeseen.',
    announced: 'Tapahtuma on julkistettu. Tarkista järjestäjän lähteistä mahdolliset muutokset ja osallistumistiedot.',
    'registration-open': 'Ilmoittautuminen on avoinna järjestäjän sivulla. Ajantasaiset ehdot ja paikkatilanne löytyvät ilmoittautumislinkistä.',
    completed: 'Tapahtuma on pelattu. Tähän on koottu lähteistä vahvistetut turnaustiedot.',
    cancelled: 'Tapahtuma on peruttu. Tarkemmat tiedot löytyvät järjestäjän lähteestä.',
  }[edition.status];
  card.append(el('p', 'ks-edition-notice', notice));
  const meta = el('div', 'ks-edition-meta');
  meta.append(el('span', '', edition.venue ? [edition.venue.name, edition.venue.address || edition.venue.city].filter(Boolean).join(' · ') : 'Pelipaikka vahvistamatta'));
  if (edition.teams.length) meta.append(el('span', '', edition.teams.length + ' julkaistua joukkuetta'));
  card.append(meta);
  const actions = el('div', 'ks-edition-actions'), maps = mapUrl(edition.venue);
  if (maps && edition.status !== 'cancelled') actions.append(externalLink(maps, 'Pelipaikka Mapsissa ↗', 'ks-map'));
  if (edition.registrationUrl && edition.status === 'registration-open') actions.append(externalLink(edition.registrationUrl, 'Ilmoittaudu järjestäjän sivulla ↗', 'ks-primary'));
  if (edition.scheduleUrl) actions.append(externalLink(edition.scheduleUrl, edition.status === 'completed' ? 'Alkuperäinen otteluohjelma ↗' : 'Otteluohjelma järjestäjän sivulla ↗', 'ks-secondary'));
  if (actions.childElementCount) card.append(actions);
  sourceRefs(card, edition.sourceIds, data); section.append(card);
  const grid = el('div', 'ks-edition-grid');
  grid.append(editionPanel('Joukkueet', edition.teams, edition.status === 'completed' ? 'Joukkuelistaa ei ole saatavilla tässä koosteessa.' : 'Joukkueita ei ole vielä julkaistu tässä koosteessa.', item => { const li = el('li', '', item.name); if (item.division) li.append(el('small', '', item.division)); return li; }));
  grid.append(editionPanel('Otteluohjelma', edition.schedule, edition.status === 'completed' ? 'Ottelukohtainen aikataulu puuttuu tästä koosteesta.' : 'Aikataulua ei ole vielä vahvistettu tähän koosteeseen.', item => { const li = el('li', '', (item.time ? item.time + ' · ' : '') + item.label); if (item.court) li.append(el('small', '', item.court)); return li; }));
  grid.append(editionPanel('Tulokset ja voittajat', edition.winners, edition.status === 'completed' ? 'Vahvistettuja tulos- tai voittajatietoja ei ole saatavilla tässä koosteessa.' : 'Tämän turnauksen tuloksia ei ole vielä saatavilla.', item => { const li = el('li', '', item.team); li.append(el('small', '', item.division)); return li; }));
  section.append(grid); parent.append(section);
}

export function renderEventDetail(parent, data, eventId, hrefForIndex) {
  const event = data.events.find(item => item.id === eventId);
  if (!event) return false;
  parent.replaceChildren(); const back = el('a', 'ks-back', '← Kaikki tapahtumat'); back.href = hrefForIndex; parent.append(back);
  const hero = el('header', 'ks-event-hero'); hero.append(el('div', 'ks-overline', event.eyebrow), el('h1', 'ks-page-title', event.title), el('p', 'ks-event-lead', event.summary)); parent.append(hero);
  const intro = el('div', 'ks-event-intro'); for (const paragraph of event.description) intro.append(el('p', '', paragraph)); sourceRefs(intro, event.sourceIds, data); parent.append(intro);
  currentEdition(parent, event, data);
  const history = el('section', 'ks-event-section'); history.append(el('h2', '', 'Tulokset ja historia'));
  if (!event.history.length) history.append(el('p', 'ks-event-missing', 'Aiempien vuosien lähteistettyjä tietoja ei ole vielä lisätty.'));
  else {
    const list = el('div', 'ks-history-list');
    for (const item of event.history) {
      const row = el('article', 'ks-history-item'); row.append(el('div', 'ks-history-year', item.year)); const text = el('div'); text.append(el('h3', '', item.title), el('p', '', item.text)); sourceRefs(text, item.sourceIds, data); row.append(text); list.append(row);
    }
    history.append(list);
  }
  parent.append(history);
  sourceSection(parent, [...event.sourceIds, ...event.currentEdition.sourceIds, ...event.history.flatMap(item => item.sourceIds)], data);
  return true;
}
