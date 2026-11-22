# Contributing

Useful contributions include source corrections, stronger event identification, parser fixes, accessible interface improvements and carefully documented observations.

For historical claims, include the event date and location, the exact source URL, the relevant passage or timestamp, and what the evidence establishes. Identify uncertainties and conflicting sources. A title, a dramatic image or a rating alone cannot establish the storm's full appearance.

For a bug, describe what happened, what you expected and how to reproduce it. Include the Python version and source snapshot ID when relevant. Do not attach credentials, private logs or copyrighted footage without a suitable reuse basis.

Every image under `web/` needs a record that names the exact file and states the basis for hosting it. For a third party image that record lives in the exhibit or in `research/`, and a note that only warns about rights does not count. An image the project draws itself goes in the `PROJECT_MADE` table of `tests/test_image_rights_coverage.py`, with the file that makes or describes it. The unit tests fail until one of the two covers the image. Images that still lack a basis are listed in that test's `KNOWN_GAPS`, and each one is an open defect.

Run the unit tests and exhibit consistency check before submitting code. If exhibit source files change, rebuild the bundle with `python -m atlas.exhibit`. Do not manually alter the copied geometry in `web/data.json`.

Keep changes focused. Adding tests that demonstrate a meaningful failure is more useful than copying implementation details into assertions. New data adapters should preserve original values and source provenance before attempting normalization.
