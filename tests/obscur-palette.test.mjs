import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The site reads in Obscur, with Clair for the light appearance. Each stylesheet
// role takes one token. As in the figures, a panel is filled with the control value.
const role = t => ({bg:t.canvas, panel:t.control, line:t.divider, text:t.text, muted:t.muted, green:t.text,
  gold:t.accent, control:t.control, 'control-hover':t.hover, selected:t.selected, 'control-line':t.border});
const OBSCUR = role(JSON.parse(readFileSync(path.join(root, 'docs/obscur-tokens.json'), 'utf8')).tokens);
// The repository records only Obscur. These are the Clair values of the same
// tokens-monochrome.json, version 1.0.0 at revision 4693831b.
const CLAIR = role({canvas:'#ffffff', control:'#f0f0f0', divider:'#aaaaaa', text:'#000000', muted:'#444444',
  accent:'#000000', hover:'#e0e0e0', selected:'#e8e8e8', border:'#666666'});

const web = path.join(root, 'web');
const read = name => readFileSync(path.join(web, name), 'utf8');
// Every site stylesheet at any depth. Vendored map styles belong to their library.
const sheets = readdirSync(web, {recursive:true}).map(String)
  .filter(name => name.endsWith('.css') && !name.startsWith('vendor')).sort();

// A hex color must end where the value ends, so an id such as #add-button is not read as one.
const HEX = /#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})(?![\w-])/gi;
const RGB = /rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)/gi;
const HSL = /hsla?\(\s*[\d.]+(?:deg)?[\s,]+([\d.]+)%?/gi;
// Color functions and names this check cannot reduce to three channels are refused outright.
const OTHER = /\b(?:oklch|oklab|lch|lab|hwb|color-mix|color)\(|:\s*(?:red|green|blue|teal|cyan|pink|orange|yellow|purple|magenta|crimson|gold|navy|maroon|olive|brown|violet|indigo|lime|aqua|fuchsia|coral|salmon|tomato|khaki|turquoise)\b/gi;

function colors(text) {
  const found = [];
  for (const match of text.matchAll(HEX)) {
    let value = match[1];
    if (value.length <= 4) value = [...value.slice(0, 3)].map(c => c + c).join('');
    found.push({literal:match[0], gray:new Set([0, 2, 4].map(i => value.slice(i, i + 2).toLowerCase())).size === 1});
  }
  for (const match of text.matchAll(RGB)) found.push({literal:match[0], gray:new Set(match.slice(1, 4)).size === 1});
  for (const match of text.matchAll(HSL)) found.push({literal:match[0], gray:Number(match[1]) === 0});
  for (const match of text.matchAll(OTHER)) found.push({literal:match[0], gray:false});
  return found;
}

function tokens(text, selector) {
  const start = text.indexOf(selector);
  assert.ok(start >= 0, 'Missing block ' + selector);
  const body = text.slice(text.indexOf('{', start) + 1, text.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):([^;}\s]+)/g)].map(match => [match[1], match[2].toLowerCase()]));
}

test('Every color written in a site stylesheet is a gray', () => {
  assert.ok(sheets.includes('appearance.css') && sheets.length > 20);
  const hued = sheets.flatMap(name => colors(read(name)).filter(color => !color.gray).map(color => name + ' ' + color.literal));
  assert.deepEqual(hued, []);
  // The scanner still sees each form of hue it knows, so the empty list does not come from a scanner that sees nothing.
  assert.deepEqual(colors('a{color:#f08bb2;fill:rgb(100,98,92);stroke:hsl(330 80% 70%);background:oklch(70% .1 200);border-color: teal}')
    .map(color => color.gray), [false, false, false, false, false]);
  assert.deepEqual(colors('#add-button{color:#cccccc;fill:rgb(102,102,102)}').map(color => color.gray), [true, true]);
});

test('The reading palette is Obscur and the light appearance is Clair', () => {
  const appearance = read('appearance.css');
  assert.deepEqual(tokens(appearance, ':root {'), OBSCUR);
  assert.deepEqual(tokens(appearance, ':root[data-appearance=light] {'), CLAIR);
  assert.deepEqual(tokens(appearance, ':root:not([data-appearance]) {'), CLAIR);
  const base = tokens(read('style.css'), ':root {');
  for (const name of ['bg', 'panel', 'line', 'text', 'muted', 'green', 'gold']) assert.equal(base[name], OBSCUR[name], name);
  const lab = read('laboratory.css');
  assert.match(lab, /\.laboratory-page \{--wind-slow-rgb:153,153,153;--wind-fast-rgb:255,255,255\}/);
  assert.equal(lab.match(/--wind-slow-rgb:102,102,102;--wind-fast-rgb:0,0,0/g).length, 2);
});

test('No fatality mark depends on a color', () => {
  for (const name of readdirSync(web).filter(name => /\.(css|mjs|js|html)$/.test(name)))
    assert.doesNotMatch(read(name), /--fatality\b/, name + ' still names the fatality color');
  const appearance = read('appearance.css');
  // Each fatality record badge carries the diamond beside its written label.
  assert.match(appearance, /\.fatality-badge::before \{content:'\\25C6';content:'\\25C6' \/ '';/);
  // Forced colors keeps its own system colors, so only the ordinary rules are read here.
  const ordinary = appearance.replace(/@media\(forced-colors:active\) \{[\s\S]*?\n\}\n/, '');
  assert.notEqual(ordinary, appearance);
  for (const rule of ['.incident-marker {', '.fatality-map-label {', '.fatality-badge {', '.survey-legend .fatality-legend {'])
    assert.match(ordinary.slice(ordinary.indexOf(rule)).split('}')[0], /var\(--text\)/, rule);
  const impact = read('impact-view.mjs'), survey = read('survey-view.mjs');
  assert.match(impact, /make\('span','◆','impact-symbol'\)/);
  assert.match(impact, /document\.createTextNode\('Show fatality locations'\)/);
  assert.match(impact, /make\('button',`◆ \$\{place\.title\} · \$\{fatalityLabel\(place\)\}`\)/);
  assert.match(survey, /el\('span','◆ Fatalities','fatality-legend'\)/);
});

test('A fatality on the map is drawn as a diamond with its written label', async () => {
  const created = [];
  const node = tag => {
    const element = {tag, attributes:{}, children:[], dataset:{}, textContent:'',
      setAttribute(name, value) {this.attributes[name] = String(value);},
      append(...nodes) {this.children.push(...nodes);}, addEventListener() {}};
    created.push(element);return element;
  };
  globalThis.document = {createElementNS:(ns, tag) => node(tag), createElement:tag => node(tag)};
  try {
    const {fatalityMarker} = await import('../web/fatality-view.mjs');
    const place = {id:'synthetic', category:'fatalities', deaths:2, title:'Synthetic record', people:['A', 'B'],
      label:'approximate location', map_label:'SYNTHETIC', coordinates:[-98, 35]};
    const group = fatalityMarker(place, {namespaceURI:'http://www.w3.org/2000/svg'}, () => [100, 50], () => {});
    const [mark, label] = group.children;
    assert.equal(mark.tag, 'path');assert.equal(mark.attributes.class, 'incident-marker');
    assert.equal(mark.attributes.d, 'M 100 43 l 7 7 l -7 7 l -7 -7 Z', 'The mark is a filled diamond');
    assert.match(mark.attributes['aria-label'], /^Synthetic record: 2 deaths\. A, B\. approximate location\.$/);
    assert.equal(label.tag, 'text');assert.equal(label.attributes.class, 'fatality-map-label');
    assert.equal(label.textContent, 'SYNTHETIC · approximate location');
  } finally {
    delete globalThis.document;
  }
});

test('No visible text names a hue the stylesheets no longer draw', () => {
  // docs/verification.md is a dated record of what was checked then, so it keeps its wording.
  const current = ['exhibits/el-reno-2013/visitor-guide.json', 'README.md', 'docs/fatality-records.md', 'web/data.json'];
  const visible = [...readdirSync(web).filter(name => /\.(html|mjs|js)$/.test(name)).map(read),
    ...current.map(name => readFileSync(path.join(root, name), 'utf8'))].join('\n');
  for (const phrase of [/rose diamond/i, /pink diamond/i, /cyan arrow/i, /gold dot/i, /gold arrow/i])
    assert.doesNotMatch(visible, phrase);
  // The wind figures draw with fixed values on the Obscur canvas.
  const wind = read('wind.html'), figures = wind.slice(wind.indexOf('id="passage-plan"'), wind.indexOf('id="component-diagram-reading"'));
  const hued = colors(figures).filter(color => !color.gray).map(color => color.literal);
  assert.deepEqual(hued, []);
  assert.match(figures, /FIXED PROBE: FILLED DOT/);
});
