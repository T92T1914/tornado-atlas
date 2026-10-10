import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {appearanceAt,validateAppearanceTimeline} from '../web/appearance-timeline-model.mjs';
import {loadEventPackage} from '../web/event-package-model.mjs';
import {PlaybackClock} from '../web/playback-model.mjs';

/* PHOTO_CASES
{
  "event": "synthetic-photo",
  "clock": {
    "start_utc": "2000-01-01T00:00:00Z",
    "end_utc": "2000-01-01T00:02:00Z",
    "time_zone": "UTC",
    "precision": "minute",
    "basis": "Authored clock for software checks only."
  },
  "source": {
    "id": "synthetic-publication",
    "url": "https://example.test/publication/edition-1",
    "title": "Synthetic photographic resource",
    "creator": "Synthetic creator",
    "publisher": "Synthetic publisher",
    "publication_identity": "Authored publication identity A",
    "version_identity": "Authored edition 1",
    "original_locator": "Synthetic resource A, edition 1",
    "sha256": null,
    "identity_basis": "Synthetic declaration. No resource was acquired or authenticated.",
    "rights": {
      "reuse": "external_links_only",
      "rights_holder": "Unestablished in this synthetic fixture",
      "basis": "Links only. This declaration establishes no reproduction or adaptation permission."
    }
  },
  "sample": {
    "source_id": "synthetic-publication",
    "image": {
      "original_url": "https://example.test/publication/edition-1",
      "panel_locator": "Replaced by the synthetic exposure descriptor",
      "sha256": null,
      "identity_basis": "Synthetic panel identity. No original pixels or image digest were acquired."
    },
    "timing": {
      "method": "source_reported",
      "basis": "Authored reported label for software checks.",
      "uncertainty_seconds": null,
      "uncertainty_basis": "Clock accuracy is explicitly unquantified. Whole seconds describe representation only."
    },
    "inspection": {
      "status": "still_pixels_inspected",
      "pixels": "Authored full-panel inspection declaration.",
      "reviewed_on": "2026-10-10",
      "basis": "Synthetic inspection record. The validator cannot authenticate an actual inspection."
    },
    "viewpoint": {
      "mode": "qualitative_text",
      "description": "An attributed textual viewing direction, with position and projection unestablished.",
      "basis": "Authored textual viewpoint evidence for software checks only.",
      "coordinates": null,
      "bearing_degrees": null,
      "pitch_degrees": null,
      "roll_degrees": null,
      "position_uncertainty_m": null,
      "orientation_uncertainty_degrees": null,
      "lens_calibration": null
    },
    "characteristics": [
      "The synthetic observation describes a partial sloping tonal margin."
    ],
    "boundary_limits": [
      "The synthetic observation leaves the lower termination and opposite margin unresolved."
    ],
    "shape": null,
    "extent": null
  },
  "sequences": [
    {
      "id": "single-instant",
      "basis": "One synthetic exposure, with no duration.",
      "samples": [
        {
          "id": "sample-instant",
          "exposure_id": "exposure-instant",
          "reported_utc": "2000-01-01T00:00:10Z",
          "panel_locator": "Synthetic panel I"
        }
      ]
    },
    {
      "id": "sparse-pair",
      "basis": "Two synthetic exposures. The interior remains uninspected.",
      "samples": [
        {
          "id": "sample-first",
          "exposure_id": "exposure-first",
          "reported_utc": "2000-01-01T00:00:20Z",
          "panel_locator": "Synthetic panel II"
        },
        {
          "id": "sample-second",
          "exposure_id": "exposure-second",
          "reported_utc": "2000-01-01T00:00:30Z",
          "panel_locator": "Synthetic panel III"
        }
      ]
    }
  ],
  "legacy_window": {
    "id": "legacy-authored",
    "start_utc": "2000-01-01T00:00:40Z",
    "end_utc": "2000-01-01T00:00:50Z",
    "source_id": null,
    "kind": "illustrative",
    "basis": "An existing authored window contract, not photographic geometry.",
    "registration": null,
    "keys": [
      {"at": 0, "shape": "cone", "extent": 0.4, "label": "Authored initial form"},
      {"at": 1, "shape": "wedge", "extent": 1, "label": "Authored final form"}
    ]
  },
  "registered_source": {
    "id": "synthetic-footage",
    "url": "https://example.test/footage/edit-a",
    "video_id": "synthetic-edit-a",
    "creator": "Synthetic footage creator",
    "duration_seconds": 60
  },
  "registered_window": {
    "id": "synthetic-registered",
    "start_utc": "2000-01-01T00:00:40Z",
    "end_utc": "2000-01-01T00:00:50Z",
    "source_id": "synthetic-footage",
    "kind": "registered",
    "basis": "Authored continuous-video registration for software checks only.",
    "registration": {
      "source": {
        "url": "https://example.test/footage/edit-a",
        "video_id": "synthetic-edit-a",
        "original_locator": "https://example.test/footage/edit-a",
        "edit_identity": "Synthetic edit A",
        "sha256": null,
        "identity_basis": "Authored software fixture. No media identity was authenticated."
      },
      "inspection": {
        "status": "continuous_video_inspected",
        "start_video_seconds": 10,
        "end_video_seconds": 20,
        "reviewed_on": "2026-10-10",
        "discontinuities": "none_observed",
        "basis": "Synthetic continuous-inspection declaration. No footage was inspected."
      },
      "timing": {
        "method": "linear_verified",
        "anchors": [
          {"video_seconds": 10, "utc": "2000-01-01T00:00:40Z"},
          {"video_seconds": 15, "utc": "2000-01-01T00:00:45Z"},
          {"video_seconds": 20, "utc": "2000-01-01T00:00:50Z"}
        ],
        "uncertainty_seconds": 0.5,
        "basis": "Authored synthetic clock alignment."
      },
      "camera": {
        "mode": "fixed_view",
        "coordinates": [0, 0],
        "bearing_degrees": 90,
        "pitch_degrees": 0,
        "roll_degrees": 0,
        "position_uncertainty_m": 10,
        "orientation_uncertainty_degrees": 2,
        "lens_calibration": "Authored lens declaration. No lens was calibrated.",
        "basis": "Authored synthetic fixed-camera record."
      },
      "rights": {
        "reuse": "external_links_only",
        "creator": "Synthetic footage creator",
        "uploader": "Synthetic uploader",
        "rights_holder": "Unestablished in this synthetic fixture",
        "basis": "Synthetic external-link declaration. Reuse permission is unestablished."
      },
      "uncertainty": "Every observation, clock and camera field is synthetic and admits no historical appearance."
    },
    "keys": [
      {"at": 0, "shape": "cone", "extent": 0.4, "label": "Synthetic initial form"},
      {"at": 1, "shape": "wedge", "extent": 1, "label": "Synthetic final form"}
    ]
  },
  "registered_invalid": [
    {"name": "paused-only inspection cannot qualify registered footage", "error": "inspection", "changes": [
      {"op": "set", "path": ["windows", 0, "registration", "inspection", "status"], "value": "paused_samples_inspected"}
    ]},
    {"name": "still inspection cannot qualify registered footage", "error": "inspection", "changes": [
      {"op": "set", "path": ["windows", 0, "registration", "inspection", "status"], "value": "still_pixels_inspected"}
    ]},
    {"name": "continuous inspection cannot qualify a photo", "error": "still", "changes": [
      {"op": "set", "path": ["photo_sequences", 0, "samples", 0, "inspection", "status"], "value": "continuous_video_inspected"}
    ]},
    {"name": "registered edit identity remains source-bound", "error": "identity", "changes": [
      {"op": "set", "path": ["windows", 0, "registration", "source", "video_id"], "value": "different-synthetic-edit"}
    ]}
  ],
  "valid": [
    {"name": "base", "changes": []},
    {"name": "UTC suffix", "changes": [
      {"op": "set", "path": ["photo_sequences", 1, "samples", 1, "reported_utc"], "value": "2000-01-01T00:00:30+00:00"}
    ]},
    {"name": "resource and image digests", "changes": [
      {"op": "repeat", "path": ["photo_sources", 0, "sha256"], "value": "a", "count": 64},
      {"op": "repeat", "path": ["photo_sequences", 0, "samples", 0, "image", "sha256"], "value": "b", "count": 64}
    ]},
    {"name": "inclusive lower bound", "changes": [
      {"op": "set", "path": ["photo_sequences", 0, "samples", 0, "reported_utc"], "value": "2000-01-01T00:00:00Z"}
    ]},
    {"name":"integer-valued V2 schema number","changes":[{"op":"set","path":["schema_version"],"value":2.0}]},
    {"name": "inclusive upper bound", "changes": [
      {"op": "set", "path": ["photo_sequences", 1, "samples", 1, "reported_utc"], "value": "2000-01-01T00:02:00Z"}
    ]},
    {"name": "16 distinct resource sources", "changes": [
      {"op": "fill_unique", "kind": "sources", "path": ["photo_sources"], "from": ["photo_sources", 0], "count": 16}
    ]},
    {"name": "16 distinct sparse sequences", "changes": [
      {"op": "fill_unique", "kind": "sequences", "path": ["photo_sequences"], "from": ["photo_sequences", 0], "count": 16}
    ]},
    {"name": "64 distinct ordered samples", "changes": [
      {"op": "fill_unique", "kind": "samples", "path": ["photo_sequences", 0, "samples"], "from": ["photo_sequences", 0, "samples", 0], "count": 64}
    ]},
    {"name": "256 aggregate samples", "changes": [
      {"op": "fill_unique", "kind": "sequences", "path": ["photo_sequences"], "from": ["photo_sequences", 0], "count": 16, "sample_count": 16}
    ]},
    {"name": "ASCII punycode and case-insensitive HTTPS with maximum port", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "HTTPS://XN--BCHER-KVA.Example:65535/path?edition=1#panel"}
    ]},
    {"name": "canonical IPv4 with zero port", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://255.255.255.255:0/photo"}
    ]},
    {"name": "URL syntax does not authenticate publicness", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://127.0.0.1/photo"}
    ]},
    {"name": "five-digit decimal port spelling", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://example.test:00080/photo"}
    ]},
    {"name": "single-label DNS and query without path", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://a?edition=1#panel"}
    ]},
    {"name": "photo text with visible content among shared whitespace", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "title"], "value": "\ufeff\u0085\u001c Visible text \u001f"}
    ]},
    {"name": "supplementary title at code-point cap", "changes": [
      {"op": "repeat", "path": ["photo_sources", 0, "title"], "value": "\ud834\udd1e", "count": 512}
    ]},
    {"name": "Unicode URL suffix at code-point cap", "changes": [
      {"op": "repeat", "path": ["photo_sources", 0, "url"], "prefix": "https://example.test/", "value": "\ud834\udd1e", "count": 2027}
    ]},
    {"name": "63-character DNS label", "changes": [
      {"op": "repeat", "path": ["photo_sources", 0, "url"], "prefix": "https://", "value": "a", "count": 63, "suffix": ".test/photo"}
    ]},
    {"name": "253-character DNS host", "changes": [
      {"op": "repeat", "path": ["photo_sources", 0, "url"], "prefix": "https://", "value": "a.", "count": 126, "suffix": "a/photo"}
    ]}
  ],
  "invalid": [
    {"name":"HTTPS authority required","changes":[{"op":"set","path":["photo_sources",0,"url"],"value":"https:example.test/photo"}]},
    {"name":"forbidden hostname character","changes":[{"op":"set","path":["photo_sources",0,"url"],"value":"https://example.test|alias/photo"}]},
    {"name":"BOM-only title","changes":[{"op":"set","path":["photo_sources",0,"title"],"value":"\ufeff"}]},
    {"name":"NEL-only title","changes":[{"op":"set","path":["photo_sources",0,"title"],"value":"\u0085"}]},
    {"name": "C0 whitespace-only title", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "title"], "value": "\u001c\u001d\u001e\u001f"}
    ]},
    {"name": "supplementary title above code-point cap", "changes": [
      {"op": "repeat", "path": ["photo_sources", 0, "title"], "value": "\ud834\udd1e", "count": 513}
    ]},
    {"name": "Unicode URL suffix above code-point cap", "changes": [
      {"op": "repeat", "path": ["photo_sources", 0, "url"], "prefix": "https://example.test/", "value": "\ud834\udd1e", "count": 2028}
    ]},
    {"name": "64-character DNS label", "changes": [
      {"op": "repeat", "path": ["photo_sources", 0, "url"], "prefix": "https://", "value": "a", "count": 64, "suffix": ".test/photo"}
    ]},
    {"name": "254-character DNS host", "changes": [
      {"op": "repeat", "path": ["photo_sources", 0, "url"], "prefix": "https://", "value": "a.", "count": 126, "suffix": "aa/photo"}
    ]},
    {"name": "numeric DNS final label", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://example.123/photo"}
    ]},
    {"name": "shortened IPv4 spelling", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://127.1/photo"}
    ]},
    {"name": "IPv4 leading zero", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://192.000.2.1/photo"}
    ]},
    {"name": "IPv4 component above 255", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://192.0.2.256/photo"}
    ]},
    {"name": "integer IPv4 spelling", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://2130706433/photo"}
    ]},
    {"name": "raw Unicode hostname outside supported syntax", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://\u00e9xample.test/photo"}
    ]},
    {"name": "IPv6 outside supported syntax", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://[2001:db8::1]/photo"}
    ]},
    {"name": "leading hostname hyphen", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://-example.test/photo"}
    ]},
    {"name": "trailing hostname hyphen", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://example-.test/photo"}
    ]},
    {"name": "empty DNS label", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://example..test/photo"}
    ]},
    {"name": "trailing DNS dot", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://example.test./photo"}
    ]},
    {"name": "hostname underscore", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://example_name.test/photo"}
    ]},
    {"name": "empty port", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://example.test:/photo"}
    ]},
    {"name": "six-digit port spelling", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://example.test:000080/photo"}
    ]},
    {"name": "nondecimal port", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://example.test:abc/photo"}
    ]},
    {"name": "URL backslash", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://example.test/photo\\panel"}
    ]},
    {"name": "URL ordinary whitespace", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://example.test/photo panel"}
    ]},
    {"name": "URL BOM whitespace", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://example.test/photo\ufeff"}
    ]},
    {"name": "URL NEL whitespace", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://example.test/photo\u0085"}
    ]},
    {"name": "URL C0 control", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://example.test/photo\u0001"}
    ]},
    {"name": "URL DEL control", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://example.test/photo\u007f"}
    ]},
    {"name": "URL C1 control", "changes": [
      {"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://example.test/photo\u0080"}
    ]},
    {"name": "image URL requires explicit authority", "changes": [
      {"op": "set", "path": ["photo_sequences", 0, "samples", 0, "image", "original_url"], "value": "https:example.test/photo"}
    ]},
    {"name": "boolean version", "changes": [{"op": "set", "path": ["schema_version"], "value": true}]},
    {"name": "unsupported version", "changes": [{"op": "set", "path": ["schema_version"], "value": 3}]},
    {"name": "wrong event", "changes": [{"op": "set", "path": ["event"], "value": "other-event"}]},
    {"name": "missing photo branch", "changes": [{"op": "delete", "path": ["photo_sequences"]}]},
    {"name": "interpolation declaration", "changes": [{"op": "set", "path": ["interpolation"], "value": "linear"}]},
    {"name": "nonarray sources", "changes": [{"op": "set", "path": ["photo_sources"], "value": {}}]},
    {"name": "too many sources", "error": "at most 16 resource sources", "changes": [{"op": "fill_unique", "kind": "sources", "path": ["photo_sources"], "from": ["photo_sources", 0], "count": 17}]},
    {"name": "duplicate source id", "changes": [{"op": "append_copy", "path": ["photo_sources"], "from": ["photo_sources", 0]}]},
    {"name": "aliased resource identity", "changes": [
      {"op": "append_copy", "path": ["photo_sources"], "from": ["photo_sources", 0]},
      {"op": "set", "path": ["photo_sources", 1, "id"], "value": "resource-alias"}
    ]},
    {"name": "malformed source id", "changes": [{"op": "set", "path": ["photo_sources", 0, "id"], "value": "Bad ID"}]},
    {"name": "oversized source id", "changes": [{"op": "repeat", "path": ["photo_sources", 0, "id"], "value": "x", "count": 65}]},
    {"name": "nonoriginal protocol", "changes": [{"op": "set", "path": ["photo_sources", 0, "url"], "value": "http://example.test/publication"}]},
    {"name": "credential URL", "changes": [{"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://user:secret@example.test/publication"}]},
    {"name": "invalid port", "changes": [{"op": "set", "path": ["photo_sources", 0, "url"], "value": "https://example.test:99999/publication"}]},
    {"name": "missing title", "changes": [{"op": "delete", "path": ["photo_sources", 0, "title"]}]},
    {"name": "oversized title", "changes": [{"op": "repeat", "path": ["photo_sources", 0, "title"], "value": "x", "count": 513}]},
    {"name": "missing creator", "changes": [{"op": "set", "path": ["photo_sources", 0, "creator"], "value": null}]},
    {"name": "missing publisher", "changes": [{"op": "set", "path": ["photo_sources", 0, "publisher"], "value": ""}]},
    {"name": "missing publication identity", "changes": [{"op": "delete", "path": ["photo_sources", 0, "publication_identity"]}]},
    {"name": "missing version", "changes": [{"op": "set", "path": ["photo_sources", 0, "version_identity"], "value": " "}]},
    {"name": "missing resource locator", "changes": [{"op": "delete", "path": ["photo_sources", 0, "original_locator"]}]},
    {"name": "missing source identity basis", "changes": [{"op": "set", "path": ["photo_sources", 0, "identity_basis"], "value": ""}]},
    {"name": "malformed source digest", "changes": [{"op": "set", "path": ["photo_sources", 0, "sha256"], "value": "not-a-digest"}]},
    {"name": "unsupported reuse", "changes": [{"op": "set", "path": ["photo_sources", 0, "rights", "reuse"], "value": "hosted_images"}]},
    {"name": "missing rights basis", "changes": [{"op": "delete", "path": ["photo_sources", 0, "rights", "basis"]}]},
    {"name": "nonarray sequences", "changes": [{"op": "set", "path": ["photo_sequences"], "value": null}]},
    {"name": "too many sequences", "error": "at most 16 sparse sequences", "changes": [{"op": "fill_unique", "kind": "sequences", "path": ["photo_sequences"], "from": ["photo_sequences", 0], "count": 17}]},
    {"name": "duplicate sequence", "changes": [{"op": "append_copy", "path": ["photo_sequences"], "from": ["photo_sequences", 0]}]},
    {"name": "invented sequence duration", "changes": [{"op": "set", "path": ["photo_sequences", 0, "duration_seconds"], "value": 1}]},
    {"name": "empty samples", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples"], "value": []}]},
    {"name": "too many samples", "error": "one through 64 samples", "changes": [{"op": "fill_unique", "kind": "samples", "path": ["photo_sequences", 0, "samples"], "from": ["photo_sequences", 0, "samples", 0], "count": 65}]},
    {"name": "duplicate sample id", "changes": [{"op": "copy", "path": ["photo_sequences", 1, "samples", 0, "id"], "from": ["photo_sequences", 0, "samples", 0, "id"]}]},
    {"name": "missing source reference", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "source_id"], "value": "absent-resource"}]},
    {"name": "nontext source reference", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "source_id"], "value": []}]},
    {"name": "duplicate exposure in another sequence", "changes": [{"op": "copy", "path": ["photo_sequences", 1, "samples", 0, "exposure_id"], "from": ["photo_sequences", 0, "samples", 0, "exposure_id"]}]},
    {"name": "crop is not a second exposure", "changes": [
      {"op": "copy", "path": ["photo_sequences", 1, "samples", 1, "exposure_id"], "from": ["photo_sequences", 1, "samples", 0, "exposure_id"]},
      {"op": "set", "path": ["photo_sequences", 1, "samples", 1, "image", "original_url"], "value": "https://example.test/publication/edition-1#enlargement"},
      {"op": "set", "path": ["photo_sequences", 1, "samples", 1, "image", "panel_locator"], "value": "A different crop locator"}
    ]},
    {"name": "renamed identical panel", "changes": [{"op": "copy", "path": ["photo_sequences", 1, "samples", 1, "image"], "from": ["photo_sequences", 1, "samples", 0, "image"]}]},
    {"name": "missing panel provenance", "changes": [{"op": "delete", "path": ["photo_sequences", 0, "samples", 0, "image", "panel_locator"]}]},
    {"name": "missing image identity basis", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "image", "identity_basis"], "value": ""}]},
    {"name": "boolean image digest", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "image", "sha256"], "value": true}]},
    {"name": "missing original image URL", "changes": [{"op": "delete", "path": ["photo_sequences", 0, "samples", 0, "image", "original_url"]}]},
    {"name": "invalid calendar date", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "reported_utc"], "value": "2000-02-30T00:00:10Z"}]},
    {"name": "invalid year", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "reported_utc"], "value": "0000-01-01T00:00:10Z"}]},
    {"name": "fractional label", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "reported_utc"], "value": "2000-01-01T00:00:10.5Z"}]},
    {"name": "before clock", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "reported_utc"], "value": "1999-12-31T23:59:59Z"}]},
    {"name": "after clock", "changes": [{"op": "set", "path": ["photo_sequences", 1, "samples", 1, "reported_utc"], "value": "2000-01-01T00:02:01Z"}]},
    {"name": "unsorted samples", "changes": [{"op": "reverse", "path": ["photo_sequences", 1, "samples"]}]},
    {"name": "duplicate sample times", "changes": [{"op": "copy", "path": ["photo_sequences", 1, "samples", 1, "reported_utc"], "from": ["photo_sequences", 1, "samples", 0, "reported_utc"]}]},
    {"name": "unsupported timing method", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "timing", "method"], "value": "linear_verified"}]},
    {"name": "missing uncertainty explanation", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "timing", "uncertainty_basis"], "value": ""}]},
    {"name": "boolean uncertainty", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "timing", "uncertainty_seconds"], "value": true}]},
    {"name": "string uncertainty", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "timing", "uncertainty_seconds"], "value": "1"}]},
    {"name": "negative uncertainty", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "timing", "uncertainty_seconds"], "value": -1}]},
    {"name": "nonfinite uncertainty", "changes": [{"op": "number", "path": ["photo_sequences", 0, "samples", 0, "timing", "uncertainty_seconds"], "value": "nan"}]},
    {"name": "overflow uncertainty", "changes": [{"op": "number", "path": ["photo_sequences", 0, "samples", 0, "timing", "uncertainty_seconds"], "value": "infinity"}]},
    {"name": "continuous inspection claim", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "inspection", "status"], "value": "continuous_video_inspected"}]},
    {"name": "missing pixel coverage", "changes": [{"op": "delete", "path": ["photo_sequences", 0, "samples", 0, "inspection", "pixels"]}]},
    {"name": "invalid inspection date", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "inspection", "reviewed_on"], "value": "2026-02-30"}]},
    {"name": "inspection date type", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "inspection", "reviewed_on"], "value": 20261010}]},
    {"name": "missing viewpoint basis", "changes": [{"op": "delete", "path": ["photo_sequences", 0, "samples", 0, "viewpoint", "basis"]}]},
    {"name": "numeric camera coordinates", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "viewpoint", "coordinates"], "value": [0, 0]}]},
    {"name": "numeric camera bearing", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "viewpoint", "bearing_degrees"], "value": 0}]},
    {"name": "omitted null camera field", "changes": [{"op": "delete", "path": ["photo_sequences", 0, "samples", 0, "viewpoint", "pitch_degrees"]}]},
    {"name": "missing characteristics", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "characteristics"], "value": []}]},
    {"name": "nontext characteristic", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "characteristics", 0], "value": false}]},
    {"name": "oversized characteristic", "changes": [{"op": "repeat", "path": ["photo_sequences", 0, "samples", 0, "characteristics", 0], "value": "x", "count": 1001}]},
    {"name": "missing boundary limits", "changes": [{"op": "delete", "path": ["photo_sequences", 0, "samples", 0, "boundary_limits"]}]},
    {"name": "invented photographic shape", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "shape"], "value": "cone"}]},
    {"name": "invented photographic extent", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "extent"], "value": 0.5}]},
    {"name": "omitted null geometry", "changes": [{"op": "delete", "path": ["photo_sequences", 0, "samples", 0, "shape"]}]},
    {"name": "invented photographic keys", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "keys"], "value": []}]},
    {"name": "invented sample duration", "changes": [{"op": "set", "path": ["photo_sequences", 0, "samples", 0, "duration_seconds"], "value": 1}]}
  ],
  "legacy_invalid": [
    {"name": "missing endpoint", "changes": [{"op": "set", "path": ["windows", 0, "keys", 0, "at"], "value": 0.1}]},
    {"name": "boolean key position", "changes": [{"op": "set", "path": ["windows", 0, "keys", 0, "at"], "value": false}]},
    {"name": "unsupported form", "changes": [{"op": "set", "path": ["windows", 0, "keys", 0, "shape"], "value": "unsupported"}]},
    {"name": "nonfinite extent", "changes": [{"op": "number", "path": ["windows", 0, "keys", 0, "extent"], "value": "nan"}]},
    {"name": "invented dimension", "changes": [{"op": "set", "path": ["windows", 0, "keys", 0, "width_m"], "value": 1}]},
    {"name": "fractional window bound", "changes": [{"op": "set", "path": ["windows", 0, "start_utc"], "value": "2000-01-01T00:00:40.5Z"}]},
    {"name": "unregistered source claim", "changes": [{"op": "set", "path": ["windows", 0, "source_id"], "value": "legacy-source"}]},
    {"name": "unsupported window kind", "changes": [{"op": "set", "path": ["windows", 0, "kind"], "value": "photo"}]}
  ]
}
PHOTO_CASES */

const sourceText=await readFile(new URL(import.meta.url),'utf8');
const spec=JSON.parse(sourceText.match(/\/\* PHOTO_CASES\r?\n([\s\S]*?)\r?\nPHOTO_CASES \*\//)[1]);
const clone=value=>structuredClone(value);
const atPath=(value,path)=>path.reduce((current,key)=>current[key],value);

function fixture(){
  return {schema_version:2,event:spec.event,windows:[],photo_sources:[clone(spec.source)],
    photo_sequences:spec.sequences.map(sequence=>({
      id:sequence.id,basis:sequence.basis,samples:sequence.samples.map(entry=>{
        const {panel_locator,...identity}=entry;
        const sample={...clone(spec.sample),...clone(identity)};
        sample.image.panel_locator=panel_locator;
        sample.image.original_url=`${spec.source.url}#${entry.exposure_id}`;
        return sample;
      })
    }))};
}
function uniqueSample(template,lane,index){
  const sample=clone(template),identity=`${lane}-${index}`;
  sample.id=`sample-${identity}`;sample.exposure_id=`exposure-${identity}`;
  sample.image.panel_locator=`Synthetic panel ${identity}`;
  sample.reported_utc=new Date(Date.parse(spec.clock.start_utc)+index*1000).toISOString().replace('.000Z','Z');
  return sample;
}
function change(value,changes){
  for(const step of changes){
    const parent=atPath(value,step.path.slice(0,-1)),key=step.path.at(-1);
    if(step.op==='delete')delete parent[key];
    else if(step.op==='set')parent[key]=clone(step.value);
    else if(step.op==='copy')parent[key]=clone(atPath(value,step.from));
    else if(step.op==='append_copy')atPath(value,step.path).push(clone(atPath(value,step.from)));
    else if(step.op==='reverse')atPath(value,step.path).reverse();
    else if(step.op==='repeat')parent[key]=(step.prefix??'')+step.value.repeat(step.count)+(step.suffix??'');
    else if(step.op==='number')parent[key]=({nan:NaN,infinity:Infinity})[step.value];
    else if(step.op==='fill'){
      const item=clone(atPath(value,step.from));
      parent[key]=Array.from({length:step.count},()=>clone(item));
    }else if(step.op==='fill_unique'){
      const item=clone(atPath(value,step.from));
      parent[key]=Array.from({length:step.count},(_,index)=>{
        if(step.kind==='sources'){
          const source=clone(item);
          if(index){source.id=`resource-${index}`;source.url=`${item.url}?resource=${index}`;}
          return source;
        }
        if(step.kind==='sequences'){
          const sequence=clone(item);
          sequence.id=`sequence-${index}`;
          sequence.samples=Array.from({length:step.sample_count??item.samples.length},(_,sampleIndex)=>
            uniqueSample(item.samples[sampleIndex%item.samples.length],index,sampleIndex));
          return sequence;
        }
        if(step.kind==='samples')return uniqueSample(item,'filled',index);
        throw new Error(`Unsupported unique fixture kind ${step.kind}`);
      });
    }else throw new Error(`Unsupported fixture operation ${step.op}`);
  }
  return value;
}
const validate=(value,sources=[])=>validateAppearanceTimeline(value,spec.event,spec.clock,{sources});

for(const entry of spec.valid)test(`shared valid photo case: ${entry.name}`,()=>{
  const value=change(fixture(),entry.changes),before=clone(value);
  assert.equal(validate(value),value);
  assert.deepEqual(value,before);
});
for(const entry of spec.invalid)test(`shared rejected photo case: ${entry.name}`,()=>{
  assert.throws(()=>validate(change(fixture(),entry.changes)),entry.error?new RegExp(entry.error):undefined);
});

test('aggregate bounds apply across otherwise valid sparse sequences',()=>{
  const value=fixture(),template=clone(value.photo_sequences[0].samples[0]);
  value.photo_sequences=Array.from({length:16},(_,lane)=>({
    id:`sequence-${lane}`,basis:'Authored independent sparse sequence.',
    samples:Array.from({length:17},(_,index)=>{
      const sample=clone(template);
      sample.id=`sample-${lane}-${index}`;sample.exposure_id=`exposure-${lane}-${index}`;
      sample.reported_utc=`2000-01-01T00:00:${String(index).padStart(2,'0')}Z`;
      sample.image.panel_locator=`Synthetic panel ${lane}/${index}`;
      return sample;
    })
  }));
  assert.throws(()=>validate(value),/256/);
});

test('legacy windows validate identically in both timeline versions',()=>{
  for(const version of [1,2]){
    const value=version===1?{schema_version:1,event:spec.event,windows:[clone(spec.legacy_window)]}:fixture();
    value.windows=[clone(spec.legacy_window)];
    assert.equal(validate(value,[{id:'legacy-source'}]),value);
    for(const entry of spec.legacy_invalid){
      assert.throws(()=>validate(change(clone(value),entry.changes),[{id:'legacy-source'}]),entry.name);
    }
  }
  assert.throws(()=>validate({schema_version:1,event:spec.event,windows:[]}),/source/i);
  assert.throws(()=>validate({...fixture(),schema_version:1},[{id:'legacy-source'}]),/fields/);
  const mixed=fixture();mixed.windows=[clone(spec.legacy_window)];
  validate(mixed);
  assert.equal(appearanceAt(mixed,45,spec.clock.start_utc,null).state,'illustrative');
  assert.equal(appearanceAt(mixed,55,spec.clock.start_utc,null).state,'unknown');
});

test('V2 photos preserve continuous registered-footage requirements',()=>{
  const value=fixture(),sources=[clone(spec.registered_source)];
  value.windows=[clone(spec.registered_window)];
  const before=clone({value,sources});
  assert.equal(validate(value,sources),value);
  assert.deepEqual({value,sources},before);
  const start=spec.clock.start_utc,source=sources[0].id;
  assert.equal(appearanceAt(value,40,start,source).state,'observed');
  assert.equal(appearanceAt(value,45,start,source).state,'interpolated');
  assert.equal(appearanceAt(value,45,start,source).videoSeconds,15);
  assert.equal(appearanceAt(value,50,start,source).state,'observed');
  assert.equal(appearanceAt(value,10,start,source).state,'unknown');
  assert.equal(appearanceAt(value,10,start,{kind:'photo',id:'single-instant'}).state,'photo_observed');
  assert.equal(appearanceAt(value,25,start,{kind:'photo',id:'sparse-pair'}).state,'unknown');
  for(const entry of spec.registered_invalid){
    assert.throws(()=>validate(change(clone(value),entry.changes),sources),
      new RegExp(entry.error),entry.name);
  }
});

test('typed photos resolve exact instants with original context and no geometry',()=>{
  const value=validate(fixture()),start=spec.clock.start_utc;
  const single={kind:'photo',id:'single-instant'},pair={kind:'photo',id:'sparse-pair'};
  const result=appearanceAt(value,10,start,single);
  assert.equal(result.state,'photo_observed');
  assert.equal(result.source,value.photo_sources[0]);
  assert.equal(result.sample,value.photo_sequences[0].samples[0]);
  assert.equal(result.shape,null);assert.equal(result.extent,null);
  assert.equal(result.sample.timing.uncertainty_seconds,null);
  assert.equal(result.sequence.start_utc,result.sequence.end_utc);
  assert.equal(result.sequence.sample_count,1);
  for(const [seconds,relation] of [[9,'before'],[11,'after']]){
    const unknown=appearanceAt(value,seconds,start,single);
    assert.equal(unknown.state,'unknown');assert.equal(unknown.relation,relation);
    assert.equal(unknown.shape,null);assert.equal(unknown.extent,null);
    assert.equal(Object.hasOwn(unknown,'sample'),false);
  }
  for(const seconds of [20,30])assert.equal(appearanceAt(value,seconds,start,pair).state,'photo_observed');
  for(const [seconds,relation] of [[19,'before'],[20.000000001,'between'],[20.5,'between'],[25,'between'],[31,'after']]){
    const unknown=appearanceAt(value,seconds,start,pair);
    assert.equal(unknown.state,'unknown');assert.equal(unknown.relation,relation);
    assert.equal(unknown.sequence.coverage,'sparse_instants');
    assert.equal(unknown.sequence.sample_count,2);
    assert.equal(unknown.shape,null);assert.equal(unknown.extent,null);
    assert.equal(Object.hasOwn(unknown,'sample'),false);
  }
});

test('photo identities never become footage selections',()=>{
  const value=validate(fixture(),[{id:'sparse-pair'}]),start=spec.clock.start_utc;
  assert.equal(appearanceAt(value,20,start,'sparse-pair').state,'unknown');
  assert.equal(appearanceAt(value,20,start,null).state,'unknown');
  assert.equal(appearanceAt(value,20,start,{kind:'photo',id:'sparse-pair'}).state,'photo_observed');
  assert.equal(appearanceAt(value,20,start,{kind:'photo',id:'absent-sequence'}).state,'unknown');
  for(const selection of [
    {kind:'video',id:'sparse-pair'},{kind:'photo',id:null},
    {kind:'photo',id:'sparse-pair',source_id:'synthetic-publication'},[]
  ])assert.throws(()=>appearanceAt(value,20,start,selection));
});

test('the existing clock supports exact sample seeks and unknown fractional playback',()=>{
  const value=validate(fixture()),clock=new PlaybackClock(120,1);
  const selection={kind:'photo',id:'sparse-pair'},start=spec.clock.start_utc;
  clock.seek(20);
  const first=appearanceAt(value,clock.seconds,start,selection);
  assert.equal(first.state,'photo_observed');
  clock.play(100);clock.tick(350);clock.pause(350);
  assert.equal(clock.seconds,20.25);
  assert.equal(appearanceAt(value,clock.seconds,start,selection).state,'unknown');
  clock.seek(30);assert.equal(appearanceAt(value,clock.seconds,start,selection).state,'photo_observed');
  clock.seek(20);assert.deepEqual(appearanceAt(value,clock.seconds,start,selection),first);
  clock.seek(10);
  assert.equal(appearanceAt(value,clock.seconds,start,{kind:'photo',id:'single-instant'}).state,'photo_observed');
  assert.equal(appearanceAt(value,clock.seconds,start,selection).state,'unknown');
});

function packageFixture(timeline){
  const provenance={url:'https://example.test/geography-fixture',sha256:'a'.repeat(64)};
  const properties=(role,extra={})=>({role,source_url:provenance.url,source_sha256:provenance.sha256,...extra});
  const features=[
    {geometry:{type:'Point',coordinates:[0,0]},properties:properties('published_center_position',
      {utc:spec.clock.start_utc,display_time:'Synthetic start'})},
    {geometry:{type:'Point',coordinates:[1,1]},properties:properties('published_center_position',
      {utc:spec.clock.end_utc,display_time:'Synthetic end'})},
    {geometry:{type:'LineString',coordinates:[[0,0],[1,1]]},properties:properties('published_center_path')},
    {geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]},properties:properties('published_tornado_outline')}
  ];
  const config={schema_version:2,event_id:spec.event,bundle:'photo-fixture.json',clock:clone(spec.clock),
    geography_source:provenance,coverage:{positions:'published_minute_samples',
      between_positions:'linear_longitude_latitude',camera:'free_orbit',appearance:'bounded_timeline'}};
  const bundle={exhibit:{id:spec.event},geometry:{source:provenance,features},
    timeline_media:{event:spec.event},footage:{event:spec.event,sources:[],anchors:[]},
    appearance_timeline:clone(timeline)};
  if(timeline.schema_version===1)bundle.footage.sources=[{id:'legacy-source'}];
  const index={schema_version:1,default_event:spec.event,events:[{id:spec.event,
    title:'Synthetic package',documentary:'fixture.html',replay:`events/${spec.event}.json`}]};
  return {config,bundle,index};
}
async function loadSynthetic(packet,{body=null,digestBody=null}={}){
  const bytes=body??Buffer.from(JSON.stringify(packet.bundle));
  const manifest={...packet.config,bundle_sha256:createHash('sha256').update(digestBody??bytes).digest('hex')};
  const assets={'events.json':JSON.stringify(packet.index),
    [`events/${spec.event}.json`]:JSON.stringify(manifest),'photo-fixture.json':bytes};
  const fetcher=async path=>{
    assert.equal(Object.hasOwn(assets,path),true,`Unexpected synthetic asset ${path}`);
    return new Response(assets[path]);
  };
  return loadEventPackage(spec.event,{fetcher,subtle:webcrypto.subtle});
}

test('manifest v2 loads either timeline version through the existing exact-byte boundary',async()=>{
  const legacyTimeline={schema_version:1,event:spec.event,windows:[clone(spec.legacy_window)]};
  for(const timeline of [legacyTimeline,fixture()]){
    const packet=packageFixture(timeline);
    const loaded=await loadSynthetic(packet);
    assert.equal(loaded.config.schema_version,2);
    assert.equal(loaded.data.appearance_timeline.schema_version,timeline.schema_version);
    const bytes=Buffer.from(JSON.stringify(packet.bundle));
    await assert.rejects(loadSynthetic(packet,{body:Buffer.concat([bytes,Buffer.from('\n')]),digestBody:bytes}),
      /different revisions/);
    assert.equal((await loadSynthetic(packet,{body:Buffer.concat([bytes,Buffer.from('\n')])}))
      .data.appearance_timeline.schema_version,timeline.schema_version);
  }
  const packet=packageFixture(fixture());
  packet.bundle.appearance_timeline.photo_sequences[1].samples[1].exposure_id='exposure-first';
  await assert.rejects(loadSynthetic(packet),/exposure/i);
});
