# Fatality records on exhibit maps

Human impact and surveyed damage use separate records. An EF label describes
the original damage assessment. It does not say whether somebody died there.
An unclassified damage record must not become a fatality record because its
photograph resembles a known vehicle or its coordinates are nearby.

Each curated fatality location requires:

- A unique ID and the explicit category `fatalities`.
- A positive, sourced `deaths` count within the event total.
- A title and short map label.
- A location kind: `vehicle_recovery` or `documented_incident_site`.
- Published coordinates, their basis, a precision note and a time note.
- An account, public source URL and source locator.
- A list of independently sourced names already present in the remembrance.
  The list may be empty when the count is documented but names are unverified.

The validator in `atlas/impacts.py` is independent of the El Reno exhibit.
It rejects unsupported categories, bad counts, duplicate names, unknown names,
invalid coordinates and missing source details. It does not independently
verify the truth of a supplied source. Editorial review remains necessary.

The shared browser renderer uses a rose diamond, a written count and a named
record. The count and shape remain usable without color. The selected account
provides the location type, names, source and limits. It never changes an
original survey rating. Links with `?fatality=record-id#survey-explorer` restore
the human-impact selection; survey links remove that parameter.

A vehicle recovery point is not an exact death location. Several sourced
locations may refer to the same incident or people, so marker counts must not
be summed to produce the event's death total. Unlocated deaths remain in the
remembrance. No injury locations are currently curated.

Survey observations within 250 meters of a curated location offer a nearby
account link. This distance is a navigation aid, not evidence that the survey
photograph or vehicle belongs to that incident. The interface says so next to
the link. A direct identification needs its own reviewed source association.
