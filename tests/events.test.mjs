import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEvents } from '../assets/events.mjs';
import { parseRoute, routeHash } from '../assets/core.mjs';

const fixture = {
  schemaVersion: 1,
  updatedAt: '2026-10-24',
  sources: [{ id: 'test-source', label: 'Test source', url: 'https://example.com/', checkedAt: '2026-10-24T12:00:00+03:00' }],
  events: [{
    id: 'example-event', title: 'Test event', eyebrow: 'Test', summary: 'Test summary', description: ['Test paragraph'], seasonLabel: 'Test season', sourceIds: ['test-source'],
    currentEdition: { year: null, status: 'unconfirmed', dateLabel: null, venue: null, registrationUrl: null, scheduleUrl: null, teams: [], schedule: [], winners: [], sourceIds: [] },
    history: [{ year: 2025, title: 'Past event', text: 'Test history', sourceIds: ['test-source'] }],
  }],
};

test('editorial content supports an unconfirmed next edition separately from past history', () => {
  assert.deepEqual(validateEvents(fixture), { ok: true, errors: [] });
  assert.equal(fixture.events[0].currentEdition.year, null);
  assert.equal(fixture.events[0].currentEdition.registrationUrl, null);
});

test('event content rejects unsafe links, broken references and absent required fields', () => {
  const mutations = [
    data => { data.sources[0].url = 'javascript:alert(1)'; },
    data => { data.events[0].currentEdition.registrationUrl = 'http://example.com/'; },
    data => { data.events[0].history[0].sourceIds = ['missing']; },
    data => { data.events[0].currentEdition.status = 'live'; },
    data => { delete data.events[0].currentEdition.scheduleUrl; },
    data => { data.events.push(structuredClone(data.events[0])); },
  ];
  for (const mutate of mutations) { const data = structuredClone(fixture); mutate(data); assert.equal(validateEvents(data).ok, false); }
});

test('event routes can be opened independently while preserving the calendar context', () => {
  const direct = parseRoute('#/tapahtuma/winter-basket');
  assert.equal(direct.view, 'event'); assert.equal(direct.eventId, 'winter-basket'); assert.equal(direct.demo, false);
  const fromDemo = parseRoute('#/tapahtumat?demo=1&week=2026-11-02&place=all&filter=junior');
  const detail = parseRoute(routeHash({ ...fromDemo, view: 'event', eventId: 'jet-set-katukoris' }));
  assert.equal(detail.eventId, 'jet-set-katukoris'); assert.equal(detail.demo, true);
  const calendar = parseRoute(routeHash({ ...detail, view: 'calendar', eventId: null }));
  assert.equal(calendar.week, '2026-11-02'); assert.equal(calendar.filter, 'junior'); assert.equal(calendar.place, 'all');
});
