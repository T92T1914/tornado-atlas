"""Preserve the NWS Birmingham map's estimated areas and individual accounts.

This is a static source snapshot, separate from any replay or wind experiment.
An inverse projection changes coordinate representation, not field accuracy.
"""
from __future__ import annotations

import hashlib
import html
import json
import math
from pathlib import Path

from .publication import json_bytes
from .survey import polygon_location

ROOT = Path(__file__).resolve().parents[1]
EVENT = 'tuscaloosa-birmingham-2011'
ITEM = '0deae8ed1989461faf99b315bb0e3126'
AREA_LAYER = 'TCLBHM_Swath_7451'
POINT_LAYER = 'TCLBHM_Points_1947'
REFERENCE = {'wkid': 102100, 'latestWkid': 3857}
DATA_SHA256 = 'dcc72bcd35da89d8bf4095516e066b164116a9bfa94cce858a43877c6078a025'
ITEM_SHA256 = '03c21fb62f6aa0f6af26ca853ebd09364ca552e952eecf8ebf158587dea5b831'
FOLDER = 'exhibits/' + EVENT
MAP_URL = ('https://noaa.maps.arcgis.com/apps/mapviewer/index.html?configurableview=true&webmap=' + ITEM +
           '&theme=dark&bookmarks=true&legend=true&information=true&share=true&scroll=false'
           '&center=-87.27385175195786,33.364490187329956&scale=1155581.1085775')
DATA_URL = 'https://noaa.maps.arcgis.com/sharing/rest/content/items/' + ITEM + '/data?f=pjson'
PARENT_URL = 'https://www.weather.gov/bmx/event_04272011tuscbirm'


def identity(layer, fid):
    return f'{ITEM}:{layer}:{fid}'


def inverse_mercator(coordinates):
    x, y = coordinates
    return [math.degrees(x / 6378137),
            math.degrees(2 * math.atan(math.exp(y / 6378137)) - math.pi / 2)]


def finite_pair(value):
    return (isinstance(value, list) and len(value) == 2 and
            all(type(number) in (int, float) and math.isfinite(number) for number in value))


def collection(data, layer_id, geometry_type, count):
    matches = [row for row in data['operationalLayers'] if row['id'] == layer_id]
    if len(matches) != 1 or len(matches[0]['featureCollection']['layers']) != 1:
        raise ValueError('Expected one separately identified embedded survey layer')
    result = matches[0]['featureCollection']['layers'][0]
    definition = result['layerDefinition']
    if (definition['geometryType'] != geometry_type or definition['objectIdField'] != 'FID' or
            definition['spatialReference'] != REFERENCE or definition.get('timeInfo')):
        raise ValueError('Source layer identity, projection or time contract changed')
    features = result['featureSet']['features']
    if len(features) != count or [row['attributes']['FID'] for row in features] != list(range(count)):
        raise ValueError('Expected the complete original source order and distinct FIDs, including zero')
    if any(type(row['attributes']['FID']) is not int for row in features):
        raise ValueError('A source FID must be an integer, not a Boolean or string')
    return result


def compile_survey(data, item):
    """Validate this reviewed snapshot before deriving any visitor representation."""
    try:
        return _compile_survey(data, item)
    except (KeyError, TypeError, IndexError, OverflowError) as error:
        raise ValueError('Malformed embedded NWS survey snapshot') from error


def _compile_survey(data, item):
    if (item['id'] != ITEM or item['owner'] != 'NWS.BMX_noaa' or item['access'] != 'public' or
            item['type'] != 'Web Map' or item['modified'] != 1772047251000):
        raise ValueError('Expected the reviewed public agency map revision')
    if data['spatialReference'] != REFERENCE:
        raise ValueError('Expected the declared Web Mercator representation')
    areas = collection(data, AREA_LAYER, 'esriGeometryPolygon', 8)
    records = collection(data, POINT_LAYER, 'esriGeometryPoint', 198)
    polygons = []
    for feature in areas['featureSet']['features']:
        geometry, attrs = feature['geometry'], feature['attributes']
        if set(geometry) != {'rings', 'spatialReference'} or geometry['spatialReference'] != REFERENCE:
            raise ValueError('Area geometry or projection changed')
        rings = geometry['rings']
        if (len(rings) != 1 or len(rings[0]) < 4 or rings[0][0] != rings[0][-1] or
                any(not finite_pair(pair) for pair in rings[0])):
            raise ValueError('Expected one finite, closed source ring per estimated area')
        if attrs['efscale'] != 'EF4' or attrs['stormdate'] != 1303862400000:
            raise ValueError('Area rating or calendar date changed')
        if attrs['FID'] == 0:
            if (attrs['length'], attrs['width'], attrs['fatalities'], attrs['injuries']) != (80.68, 2600, 65, 1500):
                raise ValueError('Overall source summary changed')
        elif attrs['comments'] != 'Estimated EF-4 Damage Swath' or attrs['length'] != -99 or attrs['width'] != -99:
            raise ValueError('Local estimated-area classification or dimension placeholders changed')
        polygons.append({'id': identity(AREA_LAYER, attrs['FID']), 'fid': attrs['FID'],
                         'role': 'estimated_overall_footprint' if attrs['FID'] == 0 else 'estimated_local_ef4_area',
                         'source_feature': feature,
                         'coordinates': [[inverse_mercator(pair) for pair in rings[0]]]})
    if sum(len(row['source_feature']['geometry']['rings'][0]) for row in polygons) != 603:
        raise ValueError('Estimated-area vertex inventory changed')
    overall = polygons[0]['source_feature']['geometry']['rings']
    points, position_groups = [], {}
    for feature in records['featureSet']['features']:
        attrs, geometry = feature['attributes'], feature['geometry']
        xy = [geometry['x'], geometry['y']]
        if (set(geometry) != {'x', 'y', 'spatialReference'} or geometry['spatialReference'] != REFERENCE or
                not finite_pair(xy) or attrs['office'] != 'BMX' or attrs['stormdate'] != 1303862400000):
            raise ValueError('Survey point, office, projection or calendar date changed')
        coordinates = inverse_mercator(xy)
        if not finite_pair([attrs['lon'], attrs['lat']]) or any(
                round(projected, 4) != round(reported, 4)
                for projected, reported in zip(coordinates, [attrs['lon'], attrs['lat']])):
            raise ValueError('Projected and separately reported coordinate representations disagree')
        for name in ('damage_txt', 'dod_txt', 'efscale', 'damage_dir', 'windspeed', 'comments', 'office', 'image_full', 'image_thmb'):
            if not isinstance(attrs[name], str):
                raise ValueError('Expected literal source text, including placeholders')
        if type(attrs['surveydate']) is not int or attrs['surveydate'] not in {
                1303948800000, 1304035200000, 1304121600000, 1304208000000, 1306627200000, 1310428800000}:
            raise ValueError('Expected the reviewed source calendar-date labels')
        local = [area['id'] for area in polygons[1:] if
                 polygon_location(xy, area['source_feature']['geometry']['rings']) != 'outside']
        points.append({'id': identity(POINT_LAYER, attrs['FID']), 'fid': attrs['FID'],
                       'source_feature': feature, 'coordinates': coordinates,
                       'overall_relation': polygon_location(xy, overall),
                       'local_area_ids': local})
        position_groups.setdefault(tuple(xy), []).append(attrs['FID'])
    ratings = {value: sum(point['source_feature']['attributes']['efscale'] == value for point in points)
               for value in sorted({point['source_feature']['attributes']['efscale'] for point in points})}
    if ratings != {'EF0': 26, 'EF1': 48, 'EF2': 49, 'EF3': 31, 'EF4': 42, 'TSTM/Wind': 1, 'N/A': 1}:
        raise ValueError('Source rating inventory changed')
    outside = [point['fid'] for point in points if point['overall_relation'] == 'outside']
    duplicates = [group for group in position_groups.values() if len(group) > 1]
    if outside != [16, 58, 71] or len(position_groups) != 187 or len(duplicates) != 8:
        raise ValueError('Source coordinate relationships changed; review before publication')
    if sum(bool(point['local_area_ids']) for point in points) != 46:
        raise ValueError('Local estimated-area relationships changed')
    return {'schema_version': 1, 'kind': 'atlas-static-damage-survey', 'event_id': EVENT,
            'source': {'item_id': ITEM, 'owner': item['owner'], 'title': item['title'],
                       'created': item['created'], 'modified': item['modified'],
                       'retrieved_at': '2026-10-12T04:40:29Z', 'url': MAP_URL,
                       'data_url': DATA_URL, 'parent_url': PARENT_URL,
                       'data_sha256': DATA_SHA256, 'item_sha256': ITEM_SHA256,
                       'projection': REFERENCE, 'length_unit': 'miles', 'maximum_width_unit': 'yards',
                       'point_wind_unit': None, 'dates': 'Source calendar labels, not arrival or failure times.',
                       'rights': 'NWS government data, credited under https://www.weather.gov/disclaimer. No endorsement. Third-party basemap and images are separate and not copied.'},
            'polygons': polygons, 'points': points,
            'inventory': {'accounts': 198, 'estimated_areas': 8, 'vertices_including_closures': 603,
                          'unique_projected_positions': 187, 'duplicate_projected_groups': duplicates,
                          'outside_overall_fids': outside, 'ratings': ratings},
            'limits': 'Static source-reported estimated areas and survey accounts. The overall EF4 rating is not uniform local damage. Source records at the same coordinates remain separate. Outside accounts are retained. Coordinate conversion does not establish field accuracy. No visible funnel, wind field, impact clock, failure sequence or calibrated damage prediction. Source-linked photographs are uninspected and unhosted.'}


def load_survey(root=ROOT):
    folder = root / FOLDER
    data = (folder / 'survey-map-response.json').read_bytes()
    item = (folder / 'survey-map-item.json').read_bytes()
    if (len(data) != 147547 or hashlib.sha256(data).hexdigest() != DATA_SHA256 or
            len(item) != 2371 or hashlib.sha256(item).hexdigest() != ITEM_SHA256):
        raise ValueError('The reviewed original NWS map bytes changed; source review required')
    return compile_survey(json.loads(data), json.loads(item))


def publication(root=ROOT):
    survey = load_survey(root)
    raw = json_bytes(survey)
    identity_hash = hashlib.sha256(raw).hexdigest()
    filename = f'events/{EVENT}-survey-{identity_hash[:20]}.json'
    return {filename: raw, f'events/{EVENT}-survey-index.json': json_bytes({
        'schema_version': 1, 'event_id': EVENT, 'file': filename,
        'bytes': len(raw), 'sha256': identity_hash,
        'source_data_sha256': DATA_SHA256})}


def native_section(survey, filename, raw):
    """Keep every account readable before a map or script is available."""
    from datetime import datetime, timezone
    from urllib.parse import urlencode
    escape = html.escape
    map_href = escape(MAP_URL)
    all_xy = [pair for area in survey['polygons'] for pair in area['source_feature']['geometry']['rings'][0]]
    min_x, max_x = min(p[0] for p in all_xy), max(p[0] for p in all_xy)
    min_y, max_y = min(p[1] for p in all_xy), max(p[1] for p in all_xy)
    scale = min(880 / (max_x - min_x), 350 / (max_y - min_y))
    def position(pair):
        return [480 + (pair[0] - (min_x + max_x) / 2) * scale,
                210 - (pair[1] - (min_y + max_y) / 2) * scale]
    def path(ring):
        xy = [position(pair) for pair in ring]
        return 'M' + ' L'.join(f'{x:.3f},{y:.3f}' for x, y in xy) + ' Z'
    drawings = []
    for area in survey['polygons']:
        css = 'damage-overall' if area['fid'] == 0 else 'damage-local'
        drawings.append(f'<path class="{css}" d="{path(area["source_feature"]["geometry"]["rings"][0])}"/>')
    for point in survey['points']:
        x, y = position([point['source_feature']['geometry']['x'], point['source_feature']['geometry']['y']])
        drawings.append(f'<circle cx="{x:.3f}" cy="{y:.3f}" r="3" class="damage-point"/>')
    cards = []
    for point in survey['points']:
        attrs, fid = point['source_feature']['attributes'], point['fid']
        calendar_date = datetime.fromtimestamp(attrs['surveydate'] / 1000, timezone.utc).date()
        date = calendar_date.isoformat()
        date_label = f'{calendar_date:%B} {calendar_date.day}, {calendar_date.year}'
        target = 'survey-account-' + str(fid)
        route = 'tuscaloosa.html?' + urlencode({'account': point['id']}) + '#' + target
        degree = attrs['dod_txt'] if attrs['dod_txt'].strip() else 'Blank source description'
        degree_label = 'Description not established in this record' if degree == 'Null' else degree
        indicator_label = ('Indicator not established in this record' if attrs['damage_txt'] == 'Null'
                           else attrs['damage_txt'])
        description = ('The original description field reads the literal text "Null". No missing description has been supplied.'
                       if degree == 'Null' else degree)
        relation = ('Outside the estimated overall footprint. This does not identify a source error or an undamaged place.'
                    if point['overall_relation'] == 'outside' else 'Inside the estimated overall footprint.')
        local = ('Inside ' + str(len(point['local_area_ids'])) + ' separately estimated EF4 area. Its own rating remains ' + attrs['efscale'] + '.'
                 if point['local_area_ids'] else 'Outside all seven local estimated EF4 areas.')
        incomplete = ('<p class="fineprint">The source description ends with an open parenthesis. Its missing text has not been supplied.</p>'
                      if degree.rstrip().endswith('(') else '')
        if degree.startswith('20%);'):
            incomplete = '<p class="fineprint">The source description begins incompletely. Its missing beginning has not been supplied.</p>'
        cards.append(f'''<li data-account-row="{escape(point['id'])}" data-rating="{escape(attrs['efscale'])}"><details id="{target}" class="damage-account" data-account-id="{escape(point['id'])}" tabindex="-1"><summary>Account {fid + 1} · {escape(attrs['efscale'])} · {escape(degree_label)}</summary>
<h4>Account {fid + 1}: {escape(indicator_label)}</h4><p>{escape(description)}</p>{incomplete}<p>{escape(relation)} {escape(local)}</p>
<p>Survey date label: <time datetime="{date}">{date_label}</time>. Decoded as a UTC calendar date from the source field, without an arrival, failure or verified collection time.</p>
<p><a data-damage-account="{escape(point['id'])}" href="{escape(route)}">Link to this account</a> · <a href="{map_href}">Original NWS map</a></p>
<details class="damage-raw"><summary>Original fields and projected geometry</summary><p>Source FID {fid}, layer {POINT_LAYER}. Point wind values have no established unit in this map and are not measurements admitted by Atlas. Legacy image links are uninspected metadata; no image is loaded here.</p><pre>{escape(json.dumps(point['source_feature'], ensure_ascii=False, indent=2))}</pre></details></details></li>''')
    return f'''<!-- tuscaloosa-damage-survey:start -->
<section id="damage-map" class="damage-survey-section" data-survey-file="{escape(filename)}" data-survey-bytes="{len(raw)}" data-survey-sha256="{hashlib.sha256(raw).hexdigest()}">
<div class="eyebrow">THE ESTIMATED FOOTPRINT AND THE GROUND RECORD</div><h2>One track, different damage accounts.</h2>
<p>The NWS Birmingham map preserves an estimated overall footprint, seven local areas labeled estimated EF4 damage, and 198 individual survey accounts. The whole-track EF4 classification does not make every place EF4. Local accounts retain their own descriptions and ratings.</p>
<figure class="damage-source-overview"><svg viewBox="0 0 960 430" role="img" aria-labelledby="damage-overview-title damage-overview-description"><title id="damage-overview-title">NWS estimated Tuscaloosa-Birmingham footprint and survey accounts</title><desc id="damage-overview-description">North-up display of the retained projected geometry. An outlined overall footprint contains seven separately shaded estimated EF4 areas. Dots represent all 198 source accounts, including repeated coordinates and three points outside the overall estimate. This is static survey context, not a visible tornado boundary.</desc>{''.join(drawings)}</svg><figcaption>Solid outline: estimated overall footprint. Shaded dashed areas: seven local estimates of EF4 damage. Dots: survey accounts, including overlapping records. Source Web Mercator geometry is fitted to this overview. Display size is not tornado width. <a href="{PARENT_URL}">NWS survey</a> · <a href="{map_href}">Original maintained NWS map</a>.</figcaption></figure>
<p class="fineprint">These are 198 source accounts at 187 distinct projected positions. Repeated coordinates remain separate accounts. Three accounts lie outside the estimated overall footprint and remain available. Estimates and individual assessments can differ. No impact clock, changing wind field or failure sequence is assigned.</p>
<div id="damage-map-enhancement" hidden><button type="button" id="damage-map-load">Explore the damage map</button><p id="damage-map-status" role="status">The complete accounts below work without loading the interactive map.</p><div id="damage-interactive-map" hidden></div><div id="damage-map-group" hidden aria-label="Choose an account in this map group"></div><div id="damage-map-controls" hidden><button type="button" id="damage-fit">Whole estimated footprint</button><button type="button" id="damage-zoom-out">Zoom out</button><button type="button" id="damage-zoom-in">Zoom in</button><button type="button" id="damage-drag" aria-pressed="false">Enable map dragging</button></div></div>
<div id="damage-account-controls" hidden><label for="damage-rating">Local rating <select id="damage-rating"><option value="">All recorded ratings</option>{''.join(f'<option value="{escape(r)}">{escape(r)}</option>' for r in sorted(survey['inventory']['ratings']))}</select></label><label for="damage-search">Find an account <input id="damage-search" type="search" maxlength="300"></label><button type="button" id="damage-reset">Clear filters</button><label for="damage-account">Survey account <select id="damage-account"><option value="">Choose an account</option></select></label><div><button type="button" id="damage-previous" disabled>Previous account</button><button type="button" id="damage-next" disabled>Next account</button></div><p id="damage-account-status" role="status"></p></div>
<details id="survey-accounts"><summary>Read all 198 original survey accounts</summary><p>Source order is a browsing order, not the tornado's movement or the order buildings failed. Ratings are individual source assessments. Fields such as “Null”, “N/A” and blank strings are preserved in the original details.</p><ol class="damage-account-list">{''.join(cards)}</ol></details>
<details class="damage-map-method"><summary>Source edition, conversion and limits</summary><p>This is the maintained NWS Birmingham map, created in 2015 and last modified February 25, 2026, retrieved October 12, 2026. It is not a recovered 2011 map revision. Original agency data are credited under the <a href="https://www.weather.gov/disclaimer">NWS use policy</a>; this derived display is not an official replacement product or government endorsement. The original basemap, external county service and linked imagery are not copied or requested.</p><p>Raw point and ring coordinates declare Web Mercator, 102100/3857. Display latitude and longitude use spherical inverse Mercator with a radius of 6,378,137 meters. Their agreement with the separately reported coordinates to four decimal places checks representation, not field accuracy. Original source fields remain unchanged. Dates are calendar labels; point wind-speed units remain unknown. No linked photograph has been inspected or cleared by this addition.</p><p><a href="dossier.html?event={EVENT}&amp;source=bmx-estimated-damage-map#source-bmx-estimated-damage-map">Read the source and inspection record</a> · <a href="{escape(filename)}">Preserved survey package</a> · <a href="#path">Return to the six written community stops</a></p></details>
</section>
<!-- tuscaloosa-damage-survey:end -->'''


def build(root=ROOT):
    artifacts = publication(root)
    for relative, raw in artifacts.items():
        target = root / 'web' / relative
        if target.is_symlink():
            raise ValueError('A survey publication cannot be a link')
        if target.exists() and not relative.endswith('-index.json') and target.read_bytes() != raw:
            raise ValueError('An immutable survey snapshot cannot be replaced')
    article = root / 'web/tuscaloosa.html'
    if article.is_symlink():
        raise ValueError('The survey article cannot be a link')
    content = article.read_text(encoding='utf-8')
    index = json.loads(artifacts[f'events/{EVENT}-survey-index.json'])
    section = native_section(load_survey(root), index['file'], artifacts[index['file']])
    start, end = '<!-- tuscaloosa-damage-survey:start -->', '<!-- tuscaloosa-damage-survey:end -->'
    if start in content or end in content:
        if content.count(start) != 1 or content.count(end) != 1:
            raise ValueError('Survey article boundaries changed')
        before, rest = content.split(start)
        _, after = rest.split(end)
        content = before + section + after
    else:
        marker = '      <section id="field-survey">'
        if content.count(marker) != 1:
            raise ValueError('Expected the existing field-survey reading boundary')
        content = content.replace(marker, section + '\n' + marker)
    for relative, raw in artifacts.items():
        target = root / 'web' / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
    article.write_text(content, encoding='utf-8')
    return {'accounts': 198, 'estimated_areas': 8, 'artifacts': list(artifacts)}


if __name__ == '__main__':
    print(json.dumps(build()))
