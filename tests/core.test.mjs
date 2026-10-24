import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  validateSnapshot, indexSnapshot, isZonedInstant, dateKey, mondayOf, addDays,
  isoWeek, matchesForCalendar, ownResult, resultsForTeam, standingFor,
  mapUrl, freshness, STALE_AFTER_MS, parseRoute, routeHash, isCovered,
} from '../assets/core.mjs';

const demo = JSON.parse(await readFile(new URL('../data/demo.json', import.meta.url), 'utf8'));
const empty = JSON.parse(await readFile(new URL('../data/latest.json', import.meta.url), 'utf8'));
const copy = () => structuredClone(demo);

test('bundled illustrative and initial empty snapshots satisfy the consumer contract', () => {
  assert.deepEqual(validateSnapshot(demo), { ok: true, errors: [] });
  assert.deepEqual(validateSnapshot(empty), { ok: true, errors: [] });
  assert.equal(demo.mode, 'demo');
  assert.equal(empty.mode, 'empty');
  assert.equal(empty.generatedAt, null);
  assert.equal(empty.matches.length, 0);
});

test('untrustworthy source payloads fail before rendering', () => {
  const mutations = [
    data => { data.schemaVersion = 99; },
    data => { data.teams.push(structuredClone(data.teams[0])); },
    data => { data.matches[0].homeTeamId = 'unknown-team'; },
    data => { data.matches[0].homeScore = -1; },
    data => { data.matches[0].startsAt = '2026-10-24T18:00:00'; },
    data => { data.matches[0].sourceUrl = 'javascript:alert(1)'; },
    data => { data.matches[0].sourceUrl = 'https://user:password@example.com/'; },
    data => { data.coverage.teamIds = ['not-a-tracked-team']; },
    data => { data.coverage.teamIds.pop(); data.coverage.note = null; },
    data => { data.standings[0].rows[0].wins += 1; },
    data => { data.sources[0].fetchedAt = '2027-01-01T00:00:00Z'; },
  ];
  for (const mutate of mutations) { const data = copy(); mutate(data); assert.equal(validateSnapshot(data).ok, false); }
  assert.equal(isZonedInstant('2026-02-30T12:00:00+02:00'), false);
  assert.equal(isZonedInstant('2026-10-24T24:00:00+03:00'), false);
});

test('calendar boundaries follow Helsinki dates through midnight and DST', () => {
  assert.equal(dateKey('2026-10-24T21:30:00Z'), '2026-10-25');
  assert.equal(dateKey('2026-10-25T21:30:00Z'), '2026-10-25');
  assert.equal(dateKey('2026-10-25T22:30:00Z'), '2026-10-26');
  assert.equal(mondayOf('2026-10-25'), '2026-10-19');
  assert.equal(mondayOf('2026-10-26'), '2026-10-26');
  assert.equal(addDays('2026-10-19', 7), '2026-10-26');
  assert.deepEqual(isoWeek('2027-01-01'), { year: 2026, number: 53 });
});

test('Joensuu filtering uses the venue, including visiting teams and excluding unknown venues', () => {
  const data = copy(), sample = structuredClone(data.matches.find(match => match.status === 'scheduled'));
  sample.id = 'test:away-in-joensuu';
  [sample.homeTeamId, sample.awayTeamId] = [sample.awayTeamId, sample.homeTeamId];
  sample.startsAt = '2026-10-31T19:00:00+02:00'; sample.venueId = 'venue:motonet';
  const unknown = { ...sample, id: 'test:unknown-venue', venueId: null };
  data.matches = [sample, unknown];
  const idx = indexSnapshot(data), options = { week: '2026-10-26', place: 'joensuu', filter: 'all' };
  assert.deepEqual(matchesForCalendar(data, idx, options).timed.map(match => match.id), [sample.id]);
  assert.equal(matchesForCalendar(data, idx, { ...options, place: 'all' }).timed.length, 2);
});

test('undated games are separate from a selected week and juniors restrict tracked teams', () => {
  const data = copy(), sample = structuredClone(data.matches.find(match => match.homeTeamId === 'kataja:u14-tytot'));
  sample.id = 'test:undated'; sample.startsAt = null; sample.status = 'time-tbc'; sample.homeScore = sample.awayScore = null;
  data.matches = [sample];
  const result = matchesForCalendar(data, indexSnapshot(data), { week: '2027-02-01', place: 'all', filter: 'junior' });
  assert.equal(result.timed.length, 0); assert.equal(result.undated[0].id, sample.id);
  assert.equal(matchesForCalendar(data, indexSnapshot(data), { week: '2027-02-01', place: 'all', filter: 'kataja:edustus' }).undated.length, 0);
});

test('own team scores remain first for away results and are consistent with win/loss', () => {
  const match = { status: 'final', homeTeamId: 'opponent', awayTeamId: 'kataja', homeScore: 80, awayScore: 91 };
  assert.deepEqual(ownResult(match, 'kataja'), { own: 91, opponent: 80, result: 'win' });
  assert.deepEqual(ownResult(match, 'opponent'), { own: 80, opponent: 91, result: 'loss' });
  assert.equal(ownResult(match, 'other'), null);
  for (const team of demo.teams.filter(team => team.tracked)) {
    const results = resultsForTeam(demo, team.id);
    assert.equal(results.length, 5);
    assert.ok(results.every((result, i) => !i || Date.parse(results[i - 1].startsAt) >= Date.parse(result.startsAt)));
    for (const result of results) { const score = ownResult(result, team.id); assert.equal(score.result === 'win', score.own > score.opponent); }
  }
});

test('a final cup leg may be drawn and is not classified as a win or loss', () => {
  const data = copy(), match = data.matches.find(item => item.status === 'final');
  match.homeScore = 82; match.awayScore = 82;
  assert.deepEqual(validateSnapshot(data), { ok: true, errors: [] });
  for (const teamId of [match.homeTeamId, match.awayTeamId]) {
    assert.deepEqual(ownResult(match, teamId), { own: 82, opponent: 82, result: 'draw' });
  }
  match.status = 'scheduled';
  assert.equal(validateSnapshot(data).ok, false, 'non-final games still cannot contain scores');
});

test('unknown addresses and missing standings stay unknown', () => {
  assert.equal(mapUrl(null), null);
  assert.equal(mapUrl({ name: 'Hall', city: 'Joensuu', address: null }), null);
  assert.equal(mapUrl({ name: 'Hall', city: null, address: '  ' }), null);
  const url = new URL(mapUrl(demo.venues[0]));
  assert.equal(url.hostname, 'www.google.com');
  assert.match(url.searchParams.get('destination'), /Kisapolku 1, 80110 Joensuu/);
  const data = copy(); data.standings = []; data.coverage.teamIds = ['kataja:edustus'];
  assert.deepEqual(standingFor(data, 'kataja:edustus', 'missing'), { standing: null, own: null });
  assert.equal(isCovered(data, 'kataja:u14-tytot'), false);
});

test('staleness is over eight days and includes older sources in a fresh snapshot', () => {
  const data = copy(); data.mode = 'live';
  const fetched = Date.parse(data.sources[0].fetchedAt);
  assert.equal(freshness(data, new Date(fetched + STALE_AFTER_MS)).stale, false);
  assert.equal(freshness(data, new Date(fetched + STALE_AFTER_MS + 1)).stale, true);
  data.generatedAt = '2026-11-05T06:00:00+02:00';
  assert.equal(freshness(data, new Date(data.generatedAt)).stale, true);
  assert.equal(freshness(demo, new Date('2030-01-01T00:00:00Z')).stale, false);
});

test('shareable team routes preserve week, place, team filter and demo state', () => {
  const route = parseRoute('#/ottelut?demo=1&week=2026-11-08&place=all&filter=junior');
  assert.equal(route.week, '2026-11-02');
  const detail = parseRoute(routeHash({ ...route, view: 'detail', teamId: 'kataja:u14-tytot', competitionId: 'demo:competition:u14-tytot', from: 'calendar' }));
  assert.equal(detail.view, 'detail'); assert.equal(detail.teamId, 'kataja:u14-tytot');
  const returned = parseRoute(routeHash({ ...detail, view: detail.from, teamId: null, competitionId: null }));
  assert.deepEqual(returned, route);
  assert.equal(parseRoute('#/joukkue/%E0%A4%A').view, 'calendar');
  assert.equal(parseRoute('#/ottelut?week=2026-02-30').week, null);
});
