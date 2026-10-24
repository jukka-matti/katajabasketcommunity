import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateEvents } from '../assets/events.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
execFileSync('python3', [path.join(root, 'scripts/validate_data.py')], { cwd: root, stdio: 'inherit' });
const events = JSON.parse(await readFile(path.join(root, 'data/events.json'), 'utf8'));
const result = validateEvents(events);
if (!result.ok) throw new Error('Invalid event content: ' + result.errors.join(' '));
const output = path.join(root, 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
// Copy only public files. Repository metadata, source fixtures, logs and secrets stay out.
for (const entry of ['index.html', 'assets', 'data']) {
  await cp(path.join(root, entry), path.join(output, entry), { recursive: true });
}
// Real subpages provide stable marketing links and useful share-preview metadata.
// They use the same application and data as the calendar; no separate event app.
const template = await readFile(path.join(root, 'index.html'), 'utf8');
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
for (const event of events.events) {
  const title = escapeHtml(event.title + ' – Kataja Basket Community');
  const summary = escapeHtml(event.summary);
  const fallback = '<noscript><article class="ks-noscript"><h1>' + escapeHtml(event.title) + '</h1><p>' + summary + '</p>'
    + event.description.map(text => '<p>' + escapeHtml(text) + '</p>').join('')
    + '<p>' + escapeHtml(event.currentEdition.dateLabel || 'Ajankohta vahvistamatta') + '</p>'
    + '<p>Joukkueet, ohjelma ja historiakooste avautuvat, kun JavaScript on käytössä.</p></article></noscript>';
  const html = template
    .replace('<html lang="fi">', '<html lang="fi" data-initial-event="' + event.id + '">')
    .replace('<head>', '<head>\n  <base href="../../">')
    .replace(/<title>[^<]*<\/title>/, '<title>' + title + '</title>')
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + summary + '">')
    .replace('</head>', '  <meta property="og:title" content="' + title + '">\n  <meta property="og:description" content="' + summary + '">\n  <meta property="og:type" content="website">\n</head>')
    .replace(/<noscript>[\s\S]*?<\/noscript>/, fallback);
  const directory = path.join(output, 'tapahtumat', event.id);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.html'), html);
}
console.log('Static site ready in dist/, including ' + events.events.length + ' shareable event subpages.');
