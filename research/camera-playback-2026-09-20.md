# Historical playback and recorded camera viewpoints

The El Reno exhibit now uses one second-level historical clock for the path,
radar panel and a selected camera track. It begins paused. Playback rates are
1×, 15×, 60× and 120×, with 60× selected initially. At 60×, the 38-minute map
interval takes 38 seconds. Scrubbing, selecting a chapter or camera sample,
opening the timeline image viewer, and hiding the tab pause playback.

## What the camera source supplies

The [El Reno Survey Project](https://el-reno-survey.net/) publishes a numerical
metadata file used by its interactive viewer. The
[participant register](https://el-reno-survey.net/participants/) identifies
Tim Marshall. The `chaserMetaData.Marshall` array in the
[metadata file](https://el-reno-survey.net/ted/ted-elreno-metadata.js) contains
22 samples with explicit UTC timestamps, coordinates and camera 1 azimuth.
Seventeen occur within the NWS map interval, 23:04 through 23:42 UTC. Camera
2 and camera 3 directions are null in these samples.

The selected literal is preserved in `camera-marshall-literal.txt`. Its hash,
the full metadata response hash, retrieval date, locator and attribution are
in `cameras.json`. The importer reads a bounded array as data, without running
downloaded JavaScript. CI validates the checked-in excerpt without network
access. The browser receives derived sample objects in `web/data.json`.

The source viewer's `ted-elreno.js` assigns camera azimuth to a forward-arrow
rotation. This exhibit displays clockwise north bearings on its north-up map.
This is an interpretation of the published fields and viewer, not an
independent check of the camera's angular calibration. The arrow is a screen
symbol with no distance, field-of-view or visibility meaning.

## Display rules and gaps

The tornado center is linearly interpolated in longitude and latitude between
adjacent NWS minute positions. Published observations and interpolated positions
have different labels. The source GeoJSON stays unchanged, and the browser
does not extrapolate before the first or after the last position. The complete
event outline remains a static survey outline, not the tornado's instantaneous
size or shape. Second-level display precision is not second-level source accuracy.

The camera marker uses only the latest preceding sample. It stays at that
recorded location and displays its age for at most 90 seconds. That interval is
a conservative presentation choice, not a measured uncertainty estimate or a
claim that the camera stayed still. There is no camera interpolation or use of
future samples. Missing periods remain visibly empty.

For example, the 6:24:20 PM sample is too old at 6:26. The next sample is not
until 6:27:31. This track therefore cannot provide a camera position for the
6:26 photo discussed in the earlier survey-paper research. The metadata's
Schyma track only spans an early interval and has not been used to place the
later Pecos Hank notebook clips. No ground photograph or video frame has been
matched to the Marshall track in this update.

## Access and verification

The survey homepage, participant listing, findings page and
[2014 AMS conference abstract](https://ams.confex.com/ams/27SLS/webprogram/Paper254094.html)
were read. The project's statements about registering footage are attributed
method descriptions. The full conference presentation was not watched. The
metadata and viewer source were inspected as text from preserved September 20
retrievals. This pass did not continuously review the chaser videos.

Tests cover differing rendering frame rates, changing playback rates, pause
and seek, exact endpoints, no extrapolation, preservation of all published
positions, exact camera sample seeks, rejected malformed data and source
tampering, camera gaps and azimuth orientation. Local browser checks cover
keyboard scrubbing, coupled sliders, ending playback, missing camera periods,
image-node preservation and a 390-pixel viewport.

The next reconstruction step is a small, explicitly registered ground-view
sequence with usable source footage, permission for any reproduced frames,
and stated timing and viewpoint uncertainty. A camera track alone cannot
supply the visible funnel, rain curtain or debris evolution.

## Shared spatial replay context, September 24

The spatial replay now uses the same observer-selection model as the documentary
map. The layer begins hidden. Choosing one of the 17 in-window samples enables
it and pauses the shared historical clock at that exact second. A square marks
the published location, with an arrow for the reported bearing. Turning the
scene changes the arrow's projected direction. Its fixed screen length has no
distance or field-of-view meaning.

The controls distinguish an exact sample from a held sample, an expired sample
and a hidden layer. They show the source time, bearing and age. Camera positions
are never interpolated. The 6:24:20 sample remains visible at 6:25:50, but is
hidden at 6:25:51. Rewinding restores the earlier source state. An observer
outside the chosen view has a separate message and keeps its textual evidence.
Whole path changes the scene view without changing historical time.

This uses the same preserved metadata and source hashes described above. No
new camera registration or footage review is claimed. Marshall's track stays
explicitly separate from Dan Robinson's original footage. A shared clock alone
does not establish that the location or direction applies to the video.

Both publication and browser package validation now reject camera evidence from
a different event, unsupported pose fields, malformed UTC, invalid coordinates
or bearings, missing attribution or source hashes, and unreviewed display ages.
A package without observer context can still run its geographic replay.

Synthetic checks cover absent, exact, held and expired samples, rewind, playback
rate changes and long frame gaps. Projection checks include north/east bearings,
orbit changes, fixed symbol length and a close view where a visible observer's
direction crosses the near plane. The browser tests exercise both appearances
at 1280 and 390 pixels, keyboard focus, sample selection during playback, layer
switching, a camera-free package and the documentary map's matching age rules.
They run in isolated headless browsers with external requests blocked. This
checks the local interface, not physical-phone behavior, screen-reader output,
source-host availability or historical camera calibration.
