# Museum brief

## Confirmed direction

An interactive tornado museum: searchable atlas, historical reconstructions, and documented damage. The eventual scope includes recorded events worldwide and all intensities, with unrated events and uncertain historical reports represented honestly.

The central goal is an individual animated reconstruction for each tornado,
where the surviving evidence allows it. A visitor should be able to watch the
storm develop and move along its documented path, connect that progression to
photographs and footage, and understand what happened to the places and people
in its path. Start with the most infamous storms, then work outward to less
familiar events. This is a long term collection built one reviewed event at a
time, not a requirement to finish every catalogue entry before opening the museum.

The working title is Tornado Atlas. It is a local folder name, not a final brand.

## Visitor experience to build

1. Explore by location, period, rating system, and available evidence.
2. Open a storm exhibit with a timeline, source material, and reported impacts.
3. Play, pause and scrub its documented path where survey geometry is available, with timing gaps visible.
4. Watch an event-specific reconstruction develop over time, with source footage and assumptions available beside the scene.
5. Compare documented damage locations with the reconstruction without inventing when individual structures failed.

The archive can grow faster than the detailed reconstructions. A storm with only a location and historical account can have a useful record without receiving an invented photorealistic animation. Some events can support an animated map before a reconstruction of their changing appearance. Coverage should be stated for the particular interval and viewpoint, rather than treating the whole storm as either finished or unknown.

## Delivery and priorities

* The public browser museum and repository are already available on GitHub Pages and GitHub. Local use remains supported.
* Infamous tornadoes are the first reconstruction priority. Source coverage determines which can be completed next; fame alone does not fill missing observations.
* Current work uses free public data and existing local tools. No paid service is required by this plan.

One reusable playback system should read separate event packages. Each package
supplies its own path, timing, supported changes in appearance, damage locations
and sources. The same engine should be usable for the next storm without copying
the entire application. See the [reconstruction plan](reconstruction-plan.md).

## First build sequence

* Implement and verify the catalogue and source history.
* Publish a searchable map and exhibit pages using real catalogue records. The initial atlas and El Reno page are implemented.
* Complete the shared event playback design and one limited reconstruction, including an evidence timeline and documented damage layer.
* Apply the same pipeline to the next well-documented infamous storms, then expand coverage.
* Add international adapters and deliberate source-record grouping alongside exhibit work. A county segment is not automatically a separate tornado reconstruction.

El Reno 2013 is the first implemented geographic exhibit study, with an initial footage notebook. Joplin 2011 has two reviewed search aliases but remains a future exhibit candidate. Blackwell 1955 is the next source comparison candidate because two selected creators cover it. A weaker event and an international event should also exercise the design.

The initial creator collection is Pecos Hank, TornadoTRX and Swegle Studios, selected by the project owner. Reviews are organized around tornadoes and observations. Channel inclusion is not a claim that every upload has been reviewed or that each video's claims are established facts.

## Reconstruction rules

* Keep observed imagery, surveyed damage, reported accounts, and animation assumptions distinguishable.
* Never assign funnel shape or width from the intensity rating alone.
* Preserve missing information instead of filling it with convincing-looking precision.
* Keep visible condensation, debris, circulation dimensions, and damage width separate.
* A time interpolation is not a timed observation. A line between endpoints is not a survey.
* Historical visualization is separate from experimental damage simulation.
* Incomplete reporting changes across places and periods. Map density is not automatically climatology.

## Remaining difficulty

The PC can support substantial graphics work. The expensive part of historical reconstruction is finding, reconciling, and placing reliable observations. Rendering capacity cannot recover an unrecorded view of a storm.
