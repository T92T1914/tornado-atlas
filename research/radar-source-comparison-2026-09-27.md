# NWRT source frame comparison

The September 27, 2026 retrieval of the [NWS original GIF](https://www.weather.gov/images/oun/wxevents/20130531/radar/NWRT_20130531_ElReno.gif) has SHA-256 `2c8ec05523dd1db897c38b67daae0f6770921135c6ddc2e34735bc40dfa93a7a`, matching the retained September 20 source. It contains 242 frames and 10,194,559 bytes.

Pillow 12.3.0 decoded the GIF with its normal sequential frame composition. For each manifest index, the complete RGB frame was compared with the published PNG using `ImageChops.difference`. All 12 comparisons had an empty difference bounding box. Each was 597 by 599 pixels. This compares decoded pixels, not only compressed PNG hashes.

Indices checked: 151, 154, 157, 160, 163, 166, 169, 172, 175, 178, 181 and 184. The source disposal method at each selected frame was 0. The decoder retained the canvas while applying intervening frames. Frame 151 was visually inspected with its full top legend, bottom filename and surrounding map extent visible. Other frames received the pixel comparison, not a new meteorological interpretation.

The abrupt eastern echo boundary is present in the original composited frame. No extraction defect was found. The exact beam coverage and scan commands were not recovered. The [2013 instrument paper](https://nssl.noaa.gov/projects/mparsup/publications/2013.Priegnitz.29EIPT.pdf), introduction and section 2, describes a 90 degree electronic sector and pedestal tracking. Those sections were read. This supports a limited scanning capability, not an exact coverage polygon for May 31 at 23:01:37.

The [public explanation](../web/radar-source.html) distinguishes the source image extent, instrument coverage and Atlas display. The viewer uses the complete image with `object-fit: contain`; browser checks separately exercise its desktop and narrow layouts. No radar bytes were changed. The close control now says `Close viewer` for both photographs and radar images.

Reproduce source extraction with `python tools/extract_timeline_frames.py` when Pillow and the permitted source bytes are available. That existing tool verifies compressed output identity as well. A changed upstream hash requires source review rather than a silent replacement. The printed filename does not state a timezone. Its retained UTC interpretation remains explicitly qualified.
