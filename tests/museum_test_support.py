"""Permit exact reviewed Tuscaloosa summary corrections, preserving evidence."""

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
STATIC_SURVEY_LIMITS = CURRENT_LIMITS.replace(', digitized survey footprint', '') + (
    ' The separately sourced NWS estimated damage footprint and 198 static survey accounts '
    'retain their own qualifications. This static map supplies no geographic replay. '
    'Existing aftermath photographs are not matched to the new accounts.')


def assert_preserved_field(case, current, previous, field):
    expected = previous
    if field == 'reconstruction' and previous['limits'] in (OLD_LIMITS, CURRENT_LIMITS):
        expected = {**previous, 'limits': STATIC_SURVEY_LIMITS}
    case.assertEqual(current, expected, field)
