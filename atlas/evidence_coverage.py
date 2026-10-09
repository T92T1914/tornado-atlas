"""A visitor view of existing reviewed packages and evidence references."""
import html
import json
import re
from pathlib import Path
from urllib.parse import urlencode

from .archive import digest, dossiers
from .event_package import build_event_packages, fields, replay_inputs, reviewed_index

ROOT = Path(__file__).resolve().parents[1]
LAYERS = {
    'documentary': 'Documentary records',
    'chronology': 'Historical chronology',
    'geography': 'Geography',
    'footage': 'Recorded video',
    'appearance': 'Historical appearance',
    'radar': 'Radar context',
    'damage': 'Survey and damage evidence',
    'gaps': 'Gaps and source disagreements',
}
STATUS_TEXT = {
    'source_reported': 'Source-reported account', 'observed_sample': 'Inspected sample recorded',
    'disputed': 'Source disagreement', 'not_researched': 'Not researched',
    'source_label': 'Source time or date label', 'discrete_anchor': 'Discrete time anchor',
    'unregistered': 'Unregistered', 'links_only': 'Source links only',
    'permitted_hosting': 'Hosting permission recorded', 'unknown': 'Unknown reuse status',
    'restricted': 'Restricted reuse', 'reviewed_available': 'Reviewed record linked',
    'unavailable': 'Unavailable', 'documented_no_result': 'Documented search without a result',
    'not_applicable': 'Not applicable', 'published': 'Published record', 'candidate': 'Research lead',
}


def layer_references(root, doc):
    path = root / 'exhibits' / doc['id'] / 'layers.json'
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding='utf-8'))
    fields(data, ('schema_version', 'event_id', 'dossier_sha256', 'survey', 'layers'), 'evidence layer references')
    if type(data['schema_version']) is not int or data['schema_version'] != 1 or data['event_id'] != doc['id']:
        raise ValueError('Evidence layer references belong to a different event')
    if data['dossier_sha256'] != digest(doc):
        raise ValueError('Evidence layer references need review against the changed dossier')
    if data['survey'] is not None:
        fields(data['survey'], ('sha256', 'basis'), 'reviewed survey coverage')
        if not isinstance(data['survey']['basis'], str) or not data['survey']['basis'].strip():
            raise ValueError('Survey coverage needs its reviewed basis')
        if not isinstance(data['survey']['sha256'], str) or not re.fullmatch('[0-9a-f]{64}',data['survey']['sha256']):
            raise ValueError('Survey coverage needs an exact reviewed digest')
    fields(data['layers'], ('geography', 'damage', 'appearance', 'gaps'), 'context layer references')
    for layer in data['layers'].values():
        fields(layer, ('basis', 'observations', 'media'), 'layer membership')
        if not isinstance(layer['basis'], str) or not layer['basis'].strip():
            raise ValueError('Layer membership needs its reviewed classification basis')
        for kind in ('observations', 'media'):
            ids = layer[kind]
            if not isinstance(ids, list) or any(not isinstance(i, str) for i in ids) or len(set(ids)) != len(ids):
                raise ValueError('Layer references must be distinct evidence identifiers')
            if set(ids) - {item['id'] for item in doc[kind]}:
                raise ValueError('Layer reference is absent from its own event dossier')
    return {**data['layers'], 'survey':data['survey']}


def reviewed(items):
    return [item for item in items if item['status']['intake'] == 'published'
            and item['status']['availability'] == 'reviewed_available'
            and item['status']['assertion'] != 'not_researched']


def coverage_rows(root=ROOT):
    index = reviewed_index(root)
    packages = build_event_packages(root, replay_inputs(root))
    docs = {doc['id']: doc for doc in dossiers(root)}
    rows = []
    for event in index['events']:
        doc = docs.get(event['id'])
        if doc is None:
            raise ValueError('Coverage requires the selected event dossier, without borrowing another event')
        refs = layer_references(root, doc)
        media = reviewed(doc['media'])
        observations = reviewed(doc['observations'])
        config = packages.get(event['replay']) if event['replay'] else None
        bundle = json.loads(packages[config['bundle']]) if config else None
        chronology = packages.get(event.get('chronology'))
        layers = {}
        def add(identifier, state, label, basis, *, items=None, routes=None):
            layers[identifier] = {'id':identifier, 'title':LAYERS[identifier], 'state':state,
                                  'label':label, 'basis':basis, 'items':items or [], 'routes':routes or []}
        add('documentary', 'context' if doc['sources'] else 'not_linked',
            'Reviewed source records' if doc['sources'] else 'No reviewed source card linked',
            'Read the selected documentary accounts, original sources and inspection limits.' if doc['sources'] else
            'The documentary route is available. No reviewed source card is linked in this dossier.',
            routes=[('Read documentary chapter',event['documentary']),
                    ('Read this dossier version','dossier.html?'+urlencode({'event':event['id'],'revision':digest(doc)}))])
        if chronology:
            add('chronology', 'documentary', 'Documentary chronology', chronology['clock']['basis'],
                routes=[('Open documentary chronology','reconstruction.html?'+urlencode({'event':event['id']}))])
        elif config:
            add('chronology', 'geographic_clock', 'Published position clock', config['clock']['basis'],
                routes=[('Open geographic replay','reconstruction.html?'+urlencode({'event':event['id']}))])
        else:
            add('chronology','not_admitted','No interactive chronology admitted',
                'Reported or disputed time labels may be linked in the dossier. They do not supply an admitted interactive clock.')
        for identifier in ('geography','damage'):
            selected = []
            if refs:
                for kind in ('observations','media'):
                    selected.extend((kind, item) for item in reviewed(doc[kind]) if item['id'] in refs[identifier][kind])
            if identifier == 'geography' and config:
                add(identifier,'replay','Geographic replay',
                    'Published minute positions with linear longitude/latitude interpolation between them. The orbiting viewpoint and map symbol are illustrative.',
                    items=selected,routes=[('Inspect replay and its source','reconstruction.html?'+urlencode({'event':event['id']}))])
            elif identifier == 'damage' and refs and refs['survey'] is not None:
                if not bundle or digest(bundle.get('survey')) != refs['survey']['sha256'] or not bundle['survey'].get('points'):
                    raise ValueError('Mapped survey coverage differs from its reviewed event reference')
                add(identifier,'survey','Mapped, untimed survey outcomes',bundle['survey']['time_note']+' '+refs['survey']['basis'],
                    items=selected,routes=[('Inspect surveyed outcomes','reconstruction.html?'+urlencode({'event':event['id'],'survey':bundle['survey']['points'][0]['id']}))])
            else:
                add(identifier,'context' if selected else 'not_classified',
                    'Source context, without geographic replay' if selected and identifier == 'geography' else
                    'Reported outcomes and documentary context' if selected else 'No reviewed layer reference linked',
                    refs[identifier]['basis'] if refs else 'This dossier has no reviewed layer classification in this publication.',items=selected)
        videos = [('media', item) for item in media if item['kind'] == 'video']
        samples = videos and all(item['status']['temporal'] == 'discrete_anchor' for _, item in videos)
        add('footage','samples' if samples else 'context' if videos else 'not_linked',
            'Discrete video samples' if samples else 'Recorded video context' if videos else 'No reviewed video linked',
            'Each linked recording keeps its inspection scope, edit identity and clock basis. Discrete samples do not establish a continuously inspected interval.',items=videos)
        registered = [window for window in (bundle or {}).get('appearance_timeline',{}).get('windows',[]) if window['kind'] == 'registered']
        if registered and doc['reconstruction']['appearance'] == 'unregistered':
            raise ValueError('Appearance registration and dossier coverage disagree; review before publication')
        visual = []
        if refs:
            for kind in ('observations','media'):
                visual.extend((kind,item) for item in reviewed(doc[kind]) if item['id'] in refs['appearance'][kind])
        add('appearance','registered' if registered else 'not_admitted',
            'Registered intervals' if registered else 'No historical interval admitted',
            ('Appearance windows retain their published source and registration basis. ' if registered else
             'No appearance interval with reviewed historical timing and viewpoint registration is admitted in this event package. ')+
            (refs['appearance']['basis'] if refs else 'No reviewed visual-context classification is linked here.'),items=visual)
        radar = [('media', item) for item in media if item['kind'] == 'radar']
        add('radar','context' if radar else 'not_linked','Source radar context' if radar else 'No reviewed radar linked',
            'Source radar images and their clocks remain separate from optical appearance, ground-level wind and surveyed outcomes.',items=radar)
        disputed = [('observations', item) for item in observations if item['status']['assertion'] == 'disputed']
        uncertainties = list(disputed)
        if refs:
            for kind in ('observations','media'):
                for item in reviewed(doc[kind]):
                    if item['id'] in refs['gaps'][kind] and not any(k == kind and existing['id'] == item['id'] for k,existing in uncertainties):
                        uncertainties.append((kind,item))
        add('gaps','disputed' if disputed else 'unknown',
            'Source disagreements and unregistered layers' if disputed else 'Source limits and unregistered layers',
            'A missing reviewed layer is a limit of this publication. It does not establish that a historical source does not exist. '+
            (refs['gaps']['basis'] if refs else 'Inspect the pinned dossier for its recorded limits.'),items=uncertainties,
            routes=[('Inspect all limits in this dossier version','dossier.html?'+urlencode({'event':event['id'],'revision':digest(doc)}))])
        rows.append({'event':event, 'doc':doc, 'dossier_sha256':digest(doc), 'layers':layers})
    return rows


def recorded_value(value):
    """Render existing clock and inspection fields without deriving a value."""
    if value is None:
        return 'Not established in this record.'
    if isinstance(value, dict):
        return '<dl>'+''.join('<dt>'+html.escape(key.replace('_',' ').capitalize())+'</dt><dd>'+recorded_value(child)+'</dd>' for key,child in value.items())+'</dl>'
    if isinstance(value, list):
        return '<ul>'+''.join('<li>'+recorded_value(child)+'</li>' for child in value)+'</ul>'
    return html.escape(str(value))


def render_page(rows):
    esc = html.escape
    output = ['<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
              '<title>Tornado Atlas | Evidence coverage</title><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="appearance.css"><link rel="stylesheet" href="coverage.css"><script src="appearance.js"></script><script type="module" src="coverage-view.mjs"></script></head>',
              '<body><a class="skip" href="#coverage-content">Skip to coverage</a><header><a class="brand" href="atlas.html">TORNADO ATLAS</a><nav aria-label="Museum navigation"><a href="atlas.html">Map and catalogue</a><a href="dossier.html">Evidence dossiers</a><a href="coverage.html" aria-current="page">Evidence coverage</a></nav>',
              '<div class="reading-appearance"><label for="reading-appearance">Appearance</label><select id="reading-appearance" disabled><option value="dark">Obscur</option><option value="light">Clair</option><option value="system" selected>Auto</option></select><small id="reading-appearance-help">Changing appearance requires JavaScript.</small></div></header>',
              '<main id="coverage-content" tabindex="-1" class="coverage-main"><h1>Evidence coverage</h1><p>Find the published evidence and the limits of each reconstruction layer.</p><p>This compares selected reviewed records. A missing layer means no reviewed item is linked for it here. Historical sources may exist elsewhere.</p><p>Inspection and rights statements are retained from the reviewed dossiers. Generating this coverage does not repeat source inspection.</p>',
              '<form id="coverage-filters" method="get" aria-label="Filter evidence coverage"><label for="coverage-event">Event</label><select name="event" id="coverage-event"><option value="">All published events</option>']
    for row in rows:
        output.append(f'<option value="{esc(row["event"]["id"])}">{esc(row["event"]["title"])}</option>')
    output.append('</select><label for="coverage-layer">Evidence layer</label><select name="layer" id="coverage-layer"><option value="">All layers</option>')
    for identifier, title in LAYERS.items():
        output.append(f'<option value="{identifier}">{title}</option>')
    output.extend(['</select><button type="submit">Show coverage</button><a href="coverage.html">Clear filters</a></form>',
                   '<noscript><p>All published coverage is available below. Filtering requires JavaScript. The documentary, dossier and original source links remain available.</p></noscript>',
                   '<p id="coverage-status" aria-live="polite"></p><p id="coverage-error" role="alert" hidden></p><div id="coverage-results">'])
    for row in rows:
        event, doc = row['event'], row['doc']
        source_by_id = {source['id']:source for source in doc['sources']}
        output.append(f'<article class="coverage-event" data-event="{esc(event["id"])}"><h2>{esc(event["title"])}</h2><p><a href="{esc(event["documentary"])}">Read documentary chapter</a></p>')
        for layer in row['layers'].values():
            output.append(f'<section class="coverage-layer" data-layer="{layer["id"]}" data-state="{layer["state"]}" aria-labelledby="{event["id"]}-{layer["id"]}"><h3 id="{event["id"]}-{layer["id"]}">{layer["title"]}</h3><p class="coverage-state">{esc(layer["label"])}</p><p>{esc(layer["basis"])}</p>')
            for label, href in layer['routes']:
                output.append(f'<p><a href="{esc(href)}">{esc(label)}</a></p>')
            if layer['items']:
                output.append(f'<details><summary>Inspect linked evidence ({len(layer["items"])})</summary><ul class="coverage-evidence">')
                for kind, item in layer['items']:
                    source = source_by_id[item['source_id']]
                    query = {'event':event['id'],'revision':row['dossier_sha256'],'media' if kind == 'media' else 'observation':item['id']}
                    href = 'dossier.html?'+urlencode(query)+'#'+('media-' if kind == 'media' else 'observation-')+item['id']
                    output.append(f'<li><h4><a href="{esc(href)}">{esc(item["title"])}</a></h4><p>{esc(item["account"])}</p><p class="coverage-limits">{esc(item["limits"])}</p>')
                    labels = ['Evidence: '+STATUS_TEXT[item['status']['assertion']],
                              'Time: '+STATUS_TEXT[item['status']['temporal']],
                              'Place: '+('Source-reported location' if item['status']['spatial'] == 'source_reported' else 'Unregistered'),
                              'Reuse: '+STATUS_TEXT[item['status']['rights']]]
                    output.append('<p class="coverage-basis">'+' · '.join(esc(value) for value in labels)+'</p>')
                    output.append('<details><summary>Recorded time and date roles</summary><dl>')
                    for role,label in (('event','Event association'),('capture','Capture time or date'),('publication','Publication time or date'),('retrieval','Source retrieval'),('video','Video presentation bounds'),('alignment','Historical alignment')):
                        output.append('<dt>'+label+'</dt><dd>'+recorded_value(item['time'][role])+'</dd>')
                    output.append('</dl></details>')
                    output.append(f'<p>Source: <a href="{esc(source["url"])}">{esc(source["title"])}</a>. Locator: {esc(item["locator"])}</p><p>Recorded source revision: {esc(source["revision"])}</p><p>Inspection scope, retained from source card: {esc(source["access"])}</p><p>Item inspection record, retained from dossier:</p><div class="coverage-inspection">'+recorded_value(item['review'])+f'</div><p>Reuse record: {esc(source["rights"])}</p></li>')
                output.append('</ul></details>')
            output.append('</section>')
        output.append('</article>')
    output.append('</div></main><footer><p>Historical evidence, not current warnings. Replay, optical appearance, radar and damage retain separate evidence bases.</p><a href="dossier.html">Browse evidence dossiers</a></footer></body></html>')
    return ('\n'.join(output)+'\n').encode('utf-8')


def publication(root=ROOT):
    return {'coverage.html': render_page(coverage_rows(root))}


def build(root=ROOT):
    artifacts = publication(root)
    for relative, raw in artifacts.items():
        (root / 'web' / relative).write_bytes(raw)
    return {'published':list(artifacts)}


if __name__ == '__main__':
    print(json.dumps(build()))
