"""Keep principal museum routes consistent with the existing event registry."""
import json
import re
from pathlib import Path
from .museum_reading import element, link, text

ROUTES = ('atlas', 'index', 'joplin', 'blackwell', 'tuscaloosa', 'dossier', 'coverage',
          'reconstruction', 'survey', 'radar-source', 'study', 'wind', 'japan', 'curator')


def navigation(root, route):
    events = json.loads((root / 'exhibits/events.json').read_text(encoding='utf-8'))['events']
    def entry(label, destination):
        return link(label, destination, **({'aria_current':'page'} if destination == route+'.html' else {}))
    exhibits = ''.join(entry(event['title'], event['documentary']) for event in events)
    explore = ''.join(entry(label, destination) for label, destination in [
        ('Map and catalogue', 'atlas.html#catalogue'), ('El Reno spatial replay', 'reconstruction.html'),
        ('Form study', 'study.html'), ('Wind laboratory', 'wind.html')])
    evidence = ''.join(entry(label, destination) for label, destination in [
        ('Event dossiers', 'dossier.html'), ('Reconstruction coverage', 'coverage.html'),
        ('Damage survey', 'survey.html'), ('Radar source reader', 'radar-source.html'),
        ('Japan source records', 'japan.html')])
    def menu(label, content):
        return element('details', element('summary', text(label)+' '+element('span', '▾', aria_hidden='true')) + element('div', content, class_='museum-menu'))
    return element('nav', entry('Collection', 'atlas.html') + menu('Exhibits', exhibits)
                   + menu('Explore', explore) + menu('Sources', evidence),
                   class_='museum-nav', aria_label='Museum navigation')


def publish(root, check=False):
    for route in ROUTES:
        path = root / 'web' / (route+'.html')
        current = path.read_text(encoding='utf-8')
        start, end = '<!-- museum-navigation -->', '<!-- /museum-navigation -->'
        expected = start + navigation(root, route) + end
        generated, count = re.subn(re.escape(start)+r'.*?'+re.escape(end), lambda match:expected, current, flags=re.S)
        if count != 1:
            raise ValueError(f'Expected one museum navigation in {route}')
        if check:
            if generated != current:
                raise ValueError(f'Stale museum navigation: {route}')
        else:
            path.write_text(generated, encoding='utf-8', newline='\n')


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    publish(Path(__file__).resolve().parents[1], args.check)
    print('Museum navigation agrees with the event registry.')
