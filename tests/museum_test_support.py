"""Permit the one reviewed summary correction without changing evidence checks."""

OLD_LIMITS = ('No registered camera, visually inspected video interval, optical appearance, '
              'digitized survey footprint or historical wind field is published. Reported county '
              'endpoints are not a surveyed route. Contextual photographs remain useful candidates '
              'but require original pixels and item-specific attribution and rights inspection.')
CURRENT_LIMITS = ('No registered camera, visually inspected video interval, optical appearance, '
                  'digitized survey footprint or historical wind field is published. Reported county '
                  'endpoints are not a surveyed route. Five published aftermath photographs have '
                  'recorded original-pixel, attribution and item-specific hosting-basis inspections. '
                  'They remain contextual views, not registered cameras or tornado-impact times. '
                  'Additional photograph candidates require their own original pixels, attribution '
                  'and rights inspection.')


def assert_preserved_field(case, current, previous, field):
    expected = previous
    if field == 'reconstruction' and previous['limits'] == OLD_LIMITS:
        expected = {**previous, 'limits': CURRENT_LIMITS}
    case.assertEqual(current, expected, field)
