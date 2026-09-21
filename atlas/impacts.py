"""Evidence requirements for fatality locations shared by future exhibits."""
import math
import re
from urllib.parse import urlsplit


def validate_fatality_places(places, people, death_total, used_ids=None):
    ids = set(used_ids or ())
    names = {person['name'].casefold() for person in people}
    for place in places:
        if place.get('category') != 'fatalities':
            raise ValueError('A mapped fatality record needs an explicit category')
        count = place.get('deaths')
        if type(count) is not int or not 0 < count <= death_total:
            raise ValueError('Fatality count must be positive and within the event total')
        if place.get('kind') not in ('vehicle_recovery', 'documented_incident_site'):
            raise ValueError('Unsupported location kind; recovery is not an exact death location')
        if place.get('coordinate_basis') not in ('published_approximate', 'published_location'):
            raise ValueError('A published coordinate basis is required')
        if not re.fullmatch('[a-z][a-z0-9-]*', place.get('id', '')) or place['id'] in ids:
            raise ValueError('Place needs a unique section anchor')
        ids.add(place['id'])
        for key in ('label', 'title', 'map_label', 'account', 'precision_note', 'time_note', 'source_locator'):
            if not isinstance(place.get(key), str) or not place[key].strip():
                raise ValueError('Place needs evidence and precision notes')
        coords = place.get('coordinates')
        if (not isinstance(coords, list) or len(coords) != 2
                or any(type(x) not in (float, int) or not math.isfinite(x) for x in coords)
                or not -180 <= coords[0] <= 180 or not -90 <= coords[1] <= 90):
            raise ValueError('Place requires finite longitude and latitude')
        linked = place.get('people')
        if (not isinstance(linked, list) or any(not isinstance(name, str) or name.casefold() not in names for name in linked)
                or len(set(name.casefold() for name in linked)) != len(linked)):
            raise ValueError('Place must refer to distinct publicly sourced memorial names')
        if len(linked) > count:
            raise ValueError('Named people exceed the fatality count')
        source = urlsplit(place.get('source', ''))
        if source.scheme != 'https' or not source.netloc:
            raise ValueError('A public HTTPS source is required')
