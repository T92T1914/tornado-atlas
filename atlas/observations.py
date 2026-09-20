"""Validate the current, explicitly unregistered footage notebook."""
import math


def validate_notebook(notebook: dict, queue: list[dict], event_id: str) -> None:
    if notebook['event_id'] != event_id:
        raise ValueError('Notebook belongs to a different event')
    videos = {video['id']: video for video in queue}
    seen = set()
    for row in notebook['observations']:
        if row['id'] in seen:
            raise ValueError('Duplicate observation identifier')
        seen.add(row['id'])
        video = videos.get(row['video'])
        if not video or video['event_id'] != event_id:
            raise ValueError('Observation requires a matching source video')
        coverage = notebook['coverage'].get(row['video'])
        if not coverage:
            raise ValueError('Observation requires an inspection coverage record')
        values = [row['start_seconds'], row['end_seconds'], coverage['duration_seconds']]
        if not all(type(value) in (int, float) and math.isfinite(value) for value in values):
            raise ValueError('Video locators must be finite numbers')
        start, end, duration = values
        if not 0 <= start <= end < duration:
            raise ValueError('Observation is outside the source duration')
        if row['kind'] not in {'visual_sample', 'creator_annotation'}:
            raise ValueError('Unknown evidence kind')
        if row['kind'] == 'visual_sample':
            if start != end or start not in coverage['visual_samples_seconds']:
                raise ValueError('Still samples cannot claim uninspected intervals')
        # A future registered schema must require the supporting source, uncertainty
        # and coordinate/time basis before non-null placement can enter the map.
        if row['historical_utc'] is not None or row['camera_position'] is not None:
            raise ValueError('Registration evidence is not implemented in this notebook schema')
