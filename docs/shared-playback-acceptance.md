# Shared playback and bounded form windows

The geographic replay can select among registered source versions without opening competing players. The form study uses the same wall-clock model for its authored sequence and can leave a missing interval empty. These are software capabilities. They do not add historical footage, camera calibration or a completed appearance reconstruction.

## Source versions and the historical clock

The discrete footage register accepts one through eight distinct source versions. Each version keeps its original video identity, creator, rights statement, clock basis and limits. Two sources may have a checked frame at the same event second. A source cannot assign two different samples to that same second.

Selecting a source stops the timeline, closes the previous player and preserves the selected historical time. The next source requires another deliberate Load action. The source choice is retained in the URL and restored by Back and Forward, including when two choices share a clock reading. Direct links to the original seven Dan Robinson samples continue to work.

The player remains separate from the historical clock. Playing or buffering video pauses the map at the selected checked moment. A source frame is not held as evidence when the timeline moves into an unregistered interval. Late callbacks from a closed player cannot reopen it. The original timestamped source link remains available when the provider refuses playback.

The implementation uses the documented [YouTube iframe API](https://developers.google.com/youtube/iframe_api_reference), its supported seek, pause, destroy and buffering states, and the privacy-enhanced player host. Loading still contacts YouTube. The provider controls availability and may seek to a nearby frame. Compare the displayed camera clock rather than treating a requested seek time as exact frame verification.

The published exhibit still contains one reviewed source version and seven paused samples. The second source in the browser tests is explicitly synthetic. Neither the source-switch test nor a matching clock connects Dan Robinson's footage to Tim Marshall's separate camera track.

The archive projection also follows each anchor's source identity. Its original link, creator, rights statement, clock basis and limits come from that source. Alternate uploader and rights-holder identities remain unknown where the register does not establish them. Source ordering does not change those associations. The existing single-source archive documents retain their reviewed identities.

## Authored form coverage

The existing form study retains its original continuous example. Its additional bounded example has two authored windows:

| Laboratory time | Drawing |
| --- | --- |
| 0 through 10 seconds | A short cone extends within this window |
| Greater than 10 and less than 22 seconds | Grid only, no assigned funnel |
| 22 through 30 seconds | A broad form changes to a narrow form within this window |

These times, shapes and interpolation are authored choices, with no storm, physical scale or measured life cycle assigned. They are not El Reno observations. The validator refuses duplicate window identities, overlapping windows and invalid shape keys. Scrubbing backward restores the same supported window or gap. It never blends across missing coverage.

The sequence uses the existing `PlaybackClock`. Time is evaluated from a wall-clock control anchor rather than accumulated rendered frames. Changing particle detail while paused leaves sequence time unchanged. Changing playback rate uses the current clock position. Leaving the scene, hiding the page or losing its graphics context pauses motion. Context recovery retains controls and does not restart playback.

## Executed checks and remaining evidence

The affected Python checks passed 50 tests after the archive caller correction. The six changed pure-model and component files passed 23 tests. They exercise separate source identities, coincident clock samples, the existing package contract, missing coverage and different frame schedules. A control callback followed by an earlier frame timestamp is also tested against the actual study module.

Thirty distinct isolated Chromium scenarios have passed across the applicable final checks. Twenty affected source, documentary and history cases passed after independent review corrections. Ten unchanged camera and study cases passed in the preceding run. They include both appearances, 390-pixel and desktop layouts, URL history, a synthetic provider's late callback and refusal, actual WebGL draw calls across a gap, and actual browser graphics-context loss and recovery. External provider requests were blocked by the browser fixture. This is not a live YouTube acceptance test or a physical-phone result.

The independent review found source restoration, contradictory URL identities, late hidden-player playback, documentary source attribution and mixed clock sampling defects. Their corrections have adverse tests. An earlier combined browser run failed the gap-history case. A later combined attempt ended before returning an owned-job result. Both records are retained separately from the passing affected checks.

The retained El Reno [photogrammetry review](reconstruction-plan.md#september-27-source-review) establishes three inspected figure times. Original photographs, complete calibration inputs, independently checked timing uncertainty and hosting rights remain unresolved. Those samples cannot establish a continuous 28-second appearance reconstruction. This increment preserves that boundary. A historical interval needs its own supported camera, clock, appearance observations, uncertainty and rights before it can use a reviewed schema or acquire a reconstruction label.

Firefox webpage journeys require the matching Playwright test binary, which was absent from the existing local cache during this increment. Native Firefox themes are a separate project and acceptance question. No user browser profile, game process, native application setting or graphics driver was changed for these checks.
