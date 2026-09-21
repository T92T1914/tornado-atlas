# A map workspace and readable evidence

Reviewed September 21, 2026. This is a design investigation and implementation
record, not a visitor study or a claim that the site improves learning.

## What I took from the references

The supplied [September 11 Photo Collection Map](https://www.arcgis.com/apps/instant/attachmentviewer/index.html?appid=1b7d4d22866b445881b181614e25d4d4)
was inspected in a browser. Its visible interface connects a location gallery,
selected attachment, map, previous/next locations and sharing. I inspected the
introduction and selection controls. I did not audit its historical records or
obtain traffic, retention or user-study data. Calling the site successful at
engagement would need evidence beyond this inspection.

The underlying [ArcGIS Attachment Viewer documentation](https://doc.arcgis.com/en/instant-apps/latest/create-apps/attachment-viewer.htm)
describes map-focused and attachment-focused layouts, filtering, selected
features, image zoom and shareable view state. That fits a damage survey well:
the reader should be able to move between a place, its photograph and its
assessment without losing the selected record.

The [9/11 Memorial Museum resources](https://www.911memorial.org/learn/resources)
offer a different reference: timelines connect images, audio, video and
first-person accounts. This is an example of complementary evidence formats,
not proof that adding more media automatically helps comprehension.

Two papers were found through Consensus and their paper records fetched:

- Roussou and Katifori (2018), [Flow, Staging, Wayfinding, Personalization](https://consensus.app/papers/flow-staging-wayfinding-personalization-evaluating-user-roussou-katifori/56f9aaeea51c51429186e255d1badc40/). The abstract reports two museum studies involving 53 visitors. Its attention to navigation and narrative flow supports evaluating the route through information. Access here was the abstract and metadata; the publisher page could not be fetched. An in-person museum guide is not the same setting as this website.
- Vert and colleagues (2021), [User Evaluation of a Multi-Platform Digital Storytelling Concept for Cultural Heritage](https://doi.org/10.3390/math9212678). The abstract and retrieved article excerpts describe 75 survey respondents plus 30 moderated participants across desktop, mobile and other platforms. Search and interaction problems were among the reported findings. The publisher returned HTTP 429; [indexed article text](https://www.proquest.com/openview/9e32bd793d2d55b0a90961c617b0bfe4/1?cbl=2032364&pq-origsite=gscholar) was available. Its participants and heritage setting limit generalization to tornado enthusiasts.

The community leads add useful questions, with much weaker evidence. A
[tornado community post about the NWS Raleigh StoryMap](https://www.reddit.com/r/tornado/comments/mrcnef/nws_raleigh_interactive_storymap_page_on_the/)
specifically praises the ability to compare radar views. A
[9/11 archive discussion](https://www.reddit.com/r/911archive/comments/1wkv0l3/is_there_an_interactive_map_of_all_the_videos/)
asks for media, paths and a timeline while raising clutter concerns. These are
individual preferences, not a representative survey. Tornado Archive remains a
relevant comparison, but its homepage returned 403 during this review; I did
not count it as a freshly inspected interface.

## Built from those observations

- A focused El Reno survey page reuses the existing survey and photograph
  components. A broad desktop keeps map and inspector beside one another; a
  narrow screen stacks them. The full documentary remains available.
- Links between the report and focused view carry the selected observation and
  filters. Fatality selections remain a separate kind of record.
- Search in the source register covers titles, publishers and evidence notes.
  A collection filter and clear control help readers narrow 32 entries.
- External photograph and geography failures retain the preserved assessment
  and original source links. This feature does not add inferred coordinates,
  identify an unverified vehicle or change historical claims.

## Accessibility and verification

[W3C reflow guidance](https://www.w3.org/WAI/WCAG21/Understanding/reflow)
motivates a 320 CSS pixel check. Maps and data tables can need two-dimensional
layouts; that does not excuse unrelated controls overflowing the page.
[Target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
sets a 24 CSS pixel minimum with defined exceptions. The interface uses larger
44 pixel control targets where practical; that is a design choice, not a claim
that WCAG requires 44 pixels for every link.

Local verification includes source-filter and selected-record round-trip tests,
the existing exhibit/data checks, and browser interaction at narrow phone,
phone and desktop dimensions. The final measured matrix is recorded in the
local work report. These checks do not establish complete WCAG conformance,
native Safari/Firefox behavior, touch hardware behavior or visitor satisfaction.

Next visitor tasks: locate a survey photograph, explain its recorded rating,
return to the same observation after reading context, and find the source for a
claim. Record wrong turns and failed tasks as well as opinions. That would be
more informative than asking whether the page merely looks impressive.
