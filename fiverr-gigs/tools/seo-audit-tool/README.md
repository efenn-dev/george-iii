# SEO Audit Tool

Simple Python scripts for quick SEO audits you can run for Fiverr client sites.

## Files

- `audit.py` - run a single website audit and save a markdown report
- `bulk-audit.py` - run audits for multiple URLs from a text file
- `requirements.txt` - Python dependencies

## Install

```bash
pip install -r requirements.txt
```

## Single URL Audit

```bash
python audit.py https://example.com
```

This saves a report like:

```bash
audit-report-example.com.md
```

## Bulk Audit

Create a text file with one URL per line:

```text
https://example.com
https://example.org
```

Then run:

```bash
python bulk-audit.py urls.txt
```

## What the audit checks

- Title tag existence and length
- Meta description existence and length
- H1 and H2 counts
- Missing image alt text
- Internal and external link counts
- Word count
- `robots.txt`
- `sitemap.xml`
- Overall SEO score out of 100

## Notes

- The tool is designed to be simple and reliable.
- Bad URLs, timeouts, and request failures are handled without crashing the bulk runner.
- Reports are saved in markdown so they are easy to send to clients or paste into proposals.
