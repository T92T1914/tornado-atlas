# JMA case adapter

The local catalogue can import Japan Meteorological Agency tornado and gust cases. Every source case remains available, including downbursts and unresolved phenomena. Only cases explicitly classified as tornadoes enter tornado search and its source-record counts. This does not deduplicate physical storms.

```text
python -m atlas import-jma
python -m atlas search --country JP --limit 10
python -m atlas jma-cases --classification-code 6 --limit 10
```

The first command retains the published CSV in the content-addressed cache. Later calls reuse the last verified retrieval. `import-jma --refresh` makes a new bounded retrieval and preserves previous source objects. `--data-dir PATH` before the command selects a separate cache and database. `import-jma --metadata PATH` imports an already retained object using its UTF-8 retrieval metadata without making a network request.

The [JMA database](https://www.data.jma.go.jp/stats/data/bosai/tornado/index.html) publishes the [case CSV](https://www.data.jma.go.jp/stats/data/bosai/tornado/data/ichiran.csv) and [format guide](https://www.data.jma.go.jp/stats/data/bosai/tornado/data/datafmt.csv). The inspected CSV has 89 columns. The guide numbers 82 elements because the seven prefecture code/name pairs each occupy two CSV columns. Exact ordered headers are checked. Blank headers and repeated prefecture labels remain in the full ordered raw row, with its logical CSV record number. A dictionary keyed only by these labels would lose source values.

The adapter decodes CP932 strictly. Both CP932 and Shift JIS could decode the inspected source bytes. This is an explicit decoder choice, not a claim that the response declared its encoding. A changed layout, unrecognized phenomenon code, duplicate case ID or failed integrity check requires source review and rolls back the entire import.

## Classifications and missing values

The original phenomenon code and Japanese label travel with every normalized case. Code 1 is a tornado. Codes 3 and 7 retain their uncertain alternatives. Code 6 is unknown. Downbursts, gust fronts, dust devils and other gusts remain separately queryable through `jma-cases`. They do not enter confirmed tornado counts or ordinary tornado export.

Numeric fields preserve the distinction between `-9999` for unset, `-8888` for unknown and an actual reported zero. Invalid numbers receive a quality note and no normalized value. The original cells remain unchanged. Casualty and building counts retain their shared-scope fields. These fields can contain a code or a reference to another case. The adapter performs no national casualty aggregation and does not assign direct or indirect casualties that the source did not distinguish.

F and JEF remain separate damage-rating scales. JMA documents the change to JEF from 1 April 2016. Lower and upper categories remain an interval. An ambiguous boundary date leaves the scale unresolved. The adapter does not manufacture an equivalent wind measurement from a rating. The separate reported wind field retains its original value without an inferred unit.

Reported date and time components retain their missing states and asymmetric minute uncertainties. UTC and timezone remain unresolved in this adapter. Known local calendar components are readable, but they are not an established synchronization clock. Latitude and longitude are converted from reported degrees, minutes and seconds only when the full endpoint is available and valid. Angular uncertainties remain separate. The coordinate datum remains unresolved. Endpoints do not create a surveyed track, a vortex center or an interpolated appearance.

Damage length is reported in units of 100 meters and width in meters. Minimum and maximum values remain intervals. Neither interval becomes a visible funnel width or a single precise path measurement.

## Revision and publication limits

JMA uses a mutable CSV address. The catalogue uses the retained response's timezone-bearing `Last-Modified` header as an observed revision order, with the content hash identifying the exact bytes. This is not a publisher-signed release identifier. Different bytes under the same observed revision are rejected for review. A newer imported revision replaces that source's current set, including removals, while older snapshots and every original case remain in the database. An empty or zero-confirmed-tornado revision also requires review.

The existing NOAA revisions and source partitions remain intact. Country filtering distinguishes the local source records. This adapter does not itself update the deployed static atlas, supply complete national coverage or establish that all cases identify unique tornadoes. Browser publication needs a separately reviewed export and presentation of the Japanese classifications, intervals and uncertainties.

Source: Japan Meteorological Agency. The adapter transforms the source format and classifications for the Tornado Atlas local catalogue. JMA's [use terms](https://www.jma.go.jp/jma/kishou/info/coment.html) refer to the [Public Data License 1.0](https://www.digital.go.jp/resources/open_data/public_data_license_v1.0), subject to its attribution and third-party-rights exceptions. This implementation is not a JMA publication or endorsement. The source's stated collection criteria and possible revisions remain relevant to any comparison of years or countries.
