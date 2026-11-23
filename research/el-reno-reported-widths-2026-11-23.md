# El Reno: two reported funnel widths drawn in the replay scene

## Source identity and what was read

The source is Wakimoto and colleagues' 2015 photogrammetric analysis,
[DOI 10.1175/MWR-D-15-0034.1](https://doi.org/10.1175/MWR-D-15-0034.1).
On November 23, 2026 UTC I retrieved the
[eScholarship copy](https://escholarship.org/content/qt1md9s51b/qt1md9s51b_noSplash_116f4892f819852acb1afb94a8cb3b15.pdf)
that the appearance timeline already records. It has 27 pages and is 9,933,086
bytes with SHA-256
`b0d7b4b2e8aabf3e214ddbc23ca4b4bb7822b99fd389bcfb30e9422e0a8c14e9`, the same
digest as the recorded edition.

I read the extracted text of PDF pages 11 to 13 and 19 to 21. I did not look at
the figures again for this record.

## What the paper states

| Period | Statement | Where |
| --- | --- | --- |
| 2324:38 to 2324:50 UTC | The funnel was about 500 m wide at an elevation angle of 2 degrees, with a reference to Figure 5a. The northern edge was difficult to discern and is marked by a white dashed line in Figures 4 and 5. | Section 4a, PDF page 12 |
| 2324:54 to 2325:06 UTC | The funnel width had increased by this next analysis time and was about 800 m in diameter, with a reference to Figures 9a and 10a. The passage names no elevation angle for that diameter. | Section 4b, PDF page 20 |

These are my summaries and not quotations. The paper prints each period with a
dash between its two clock labels and marks both sizes as approximate. The text
extraction does not keep the paper's approximation and degree signs, so I quote
neither sentence.

The paper introduces the three periods of its section 4, these two and
2325:09 to 2325:21 UTC, as consecutive radar volume scans. It gives no funnel
width for the third.

## How the replay uses them

`exhibits/el-reno-2013/reported-widths.json` holds the two widths. Their periods
are written as whole second UTC, 23:24:38 to 23:24:50 and 23:24:54 to 23:25:06
on May 31, 2013. The record names the paper as its own source, with the DOI
address, the retained copy and the digest above. Those are the three values
the appearance timeline holds for `wakimoto-2015`, and a test keeps the two
equal.

The paper prints its periods to the second, and so does the replay clock. The
replay draws a width as a dashed circle of that diameter on the flat ground of
the scene while the whole second of the clock is one of that period's seconds,
both ends included. In the seconds between the two periods and at every other
clock it draws no width. The package validators refuse a record whose statement
does not give its own size and its own period.

The circle's center is the replay's center position for that clock. The replay
interpolates that position in a straight line between the NWS minute positions,
here 23:24, 23:25 and 23:26. At 23:25:00 the center is the published minute
position itself. I did not take the center from the paper, and the caption
under the scene says where it comes from in both cases. The caption also says
that the circle is there for scale and is not a footprint, a damage width or a
wind field.

## Limits

1. A width at a 2 degree elevation angle, seen from one side, is not a diameter
   on the ground. The circle shows the reported size at the scale of the scene.
   It is not a footprint, a damage width or a wind field.
2. The second figure has no stated elevation, so the two are not shown to be the
   same quantity. The replay draws both the same way, and the caption of each
   says how it was defined.
3. The authors found the northern edge hard to discern in the first period. The
   circle cannot show that one side is less certain than the other. The caption
   states it.
4. The center comes from interpolation between minute positions that carry no
   error bounds. In section 4a the paper gives the distance from its radar to the
   center of the tornado as about 4.95 km. I did not turn that range into a map
   position or compare it with the interpolated one.
5. The width is drawn for the whole analysis period because that is how the
   paper states it. The photograph the first width refers to carries one clock
   label, 23:24:41 UTC.
6. Photograph mode and the study modes keep only the center marker, so the
   circle is not drawn there.
7. At the default playback rate of 60 each period lasts about a fifth of a
   second on screen. The list of sourced lengths under the scene links to the
   start of each one.
8. At the whole path view the circle is a few pixels wide and sits inside the
   center marker. The tag and the caption still name it.
