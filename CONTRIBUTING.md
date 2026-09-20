# Contributing

Useful contributions include source corrections, stronger event identification, parser fixes, accessible interface improvements and carefully documented observations.

For historical claims, include the event date and location, the exact source URL, the relevant passage or timestamp, and what the evidence establishes. Identify uncertainties and conflicting sources. A title, a dramatic image or a rating alone cannot establish the storm's full appearance.

For a bug, describe what happened, what you expected and how to reproduce it. Include the Python version and source snapshot ID when relevant. Do not attach credentials, private logs or copyrighted footage without a suitable reuse basis.

Run the unit tests and exhibit consistency check before submitting code. If exhibit source files change, rebuild the bundle with `python -m atlas.exhibit`. Do not manually alter the copied geometry in `web/data.json`.

Keep changes focused. Adding tests that demonstrate a meaningful failure is more useful than copying implementation details into assertions. New data adapters should preserve original values and source provenance before attempting normalization.
