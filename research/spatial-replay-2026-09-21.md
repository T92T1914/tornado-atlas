# El Reno spatial replay

September 21, 2026

I want the historical page and the visual work to connect. This version takes
the existing NWS center positions into a three-dimensional stage. Someone can
follow the storm's published route, turn the scene and inspect the available
radar on the same clock. The atlas entrance links this view with the documentary
and wind laboratory, with the searchable records immediately below.

## Evidence used

The [NWS event account](https://www.weather.gov/oun/events-20130531) and the
preserved exhibit package supply 39 minute positions, the center path and the
whole-event outline. Existing radar records supply preceding frames with a
bounded age. No new historical coordinates, appearance dimensions or fatality
locations were introduced.

The stage converts longitude and latitude to local kilometers about the path's
center. Ground is flat. Between published positions the marker is linearly
interpolated, and the caption states that. The whole-event outline stays fixed
and does not describe the tornado's instantaneous width.

The optional procedural funnel has fixed drawing dimensions and deterministic
particles. Height, width and rotation do not come from the EF rating or a
measured wind field. An orbit view does not claim to be a witness's viewpoint.
Neither this view nor the separate wind laboratory predicts historical damage.

## Behavior checked

* Five model checks cover coordinate directions and units, camera projection,
  bounded shared times, deterministic geometry and the actual exhibit's time
  and radar coverage.
* The complete local suite passed: 110 Python tests and 81 JavaScript tests.
  The exhibit and catalogue validators passed.
* The local Chromium preview was inspected at desktop size and 390 by 844.
  Clair and Obscur were checked. No horizontal overflow was observed.
* Play, pause, the exact timeline endpoints, whole-path framing, close follow
  view and radar changes were exercised. The radar photograph loaded, and no
  browser errors or warnings were recorded during those checks.
* Playback starts paused and pauses when hidden. A reduced-motion preference
  change also pauses it. This last behavior is implemented, not separately
  verified across real operating systems.

This is not a Safari, Firefox or physical touchscreen certification. The
geometry tests do not establish an accurate reconstruction of the visible
condensation, rain or debris.

## What comes next

Register more original imagery to bounded times and viewpoints before fitting
appearance changes. Preserve unresolved intervals. Add an event package interface
before extending the same scene to another storm. Joplin is the next documentary
research target; that does not make its reconstruction ready yet.
