import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

TIMEOUT = 12
USER_AGENT = "SEO-Audit-Tool/1.0 (+https://example.com)"


def normalize_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        raise ValueError("URL is required")
    if not urlparse(url).scheme:
        url = "https://" + url
    parsed = urlparse(url)
    if not parsed.netloc:
        raise ValueError(f"Invalid URL: {url}")
    return url


def safe_filename_from_url(url: str) -> str:
    domain = urlparse(url).netloc.lower()
    domain = domain.replace(":", "-")
    return f"audit-report-{domain}.md"


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
    return session


def fetch_url(session: requests.Session, url: str, allow_redirects: bool = True) -> Tuple[requests.Response, str]:
    response = session.get(url, timeout=TIMEOUT, allow_redirects=allow_redirects)
    content_type = response.headers.get("Content-Type", "")
    if "text/html" in content_type or response.text:
        return response, response.text
    return response, ""


def extract_meta_description(soup: BeautifulSoup) -> str:
    tag = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
    if tag and tag.get("content"):
        return tag.get("content").strip()
    return ""


def count_words(soup: BeautifulSoup) -> int:
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = soup.get_text(" ", strip=True)
    words = re.findall(r"\b\w+\b", text)
    return len(words)


def analyze_links(soup: BeautifulSoup, base_url: str) -> Tuple[int, int, int]:
    parsed_base = urlparse(base_url)
    base_domain = parsed_base.netloc.lower()
    internal = 0
    external = 0
    total = 0

    for a in soup.find_all("a", href=True):
        href = a.get("href", "").strip()
        if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
            continue
        total += 1
        absolute = urljoin(base_url, href)
        parsed = urlparse(absolute)
        if parsed.scheme not in ("http", "https"):
            continue
        if parsed.netloc.lower() == base_domain:
            internal += 1
        else:
            external += 1
    return internal, external, total


def analyze_images(soup: BeautifulSoup) -> Tuple[int, int]:
    images = soup.find_all("img")
    total = len(images)
    missing_alt = 0
    for img in images:
        alt = img.get("alt")
        if alt is None or not alt.strip():
            missing_alt += 1
    return total, missing_alt


def check_exists(session: requests.Session, url: str) -> Tuple[bool, int, str]:
    try:
        response = session.get(url, timeout=TIMEOUT, allow_redirects=True)
        ok = response.status_code == 200 and bool(response.text.strip())
        return ok, response.status_code, response.url
    except requests.RequestException as exc:
        return False, 0, str(exc)


def score_report(data: Dict) -> Tuple[int, List[str], List[str]]:
    score = 100
    strengths: List[str] = []
    issues: List[str] = []

    title_length = data["title_length"]
    meta_length = data["meta_description_length"]
    h1_count = data["h1_count"]
    word_count = data["word_count"]
    total_images = data["image_count"]
    missing_alt = data["images_missing_alt"]
    internal_links = data["internal_links"]
    robots_ok = data["robots_exists"]
    sitemap_ok = data["sitemap_exists"]

    if not data["title_exists"]:
        score -= 15
        issues.append("Missing title tag")
    elif 30 <= title_length <= 60:
        strengths.append(f"Title tag length looks healthy ({title_length} characters)")
    else:
        score -= 6
        issues.append(f"Title tag length is outside the ideal range ({title_length} characters; target 30-60)")

    if not data["meta_description_exists"]:
        score -= 15
        issues.append("Missing meta description")
    elif 120 <= meta_length <= 160:
        strengths.append(f"Meta description length looks healthy ({meta_length} characters)")
    else:
        score -= 6
        issues.append(f"Meta description length is outside the ideal range ({meta_length} characters; target 120-160)")

    if h1_count == 1:
        strengths.append("Exactly one H1 tag found")
    elif h1_count == 0:
        score -= 10
        issues.append("No H1 tag found")
    else:
        score -= 6
        issues.append(f"Multiple H1 tags found ({h1_count})")

    if data["h2_count"] >= 1:
        strengths.append(f"Page uses subheadings ({data['h2_count']} H2 tags)")
    else:
        score -= 4
        issues.append("No H2 tags found")

    if word_count >= 300:
        strengths.append(f"Content length is solid ({word_count} words)")
    elif word_count >= 150:
        score -= 4
        issues.append(f"Content is a bit thin ({word_count} words)")
    else:
        score -= 10
        issues.append(f"Very low word count ({word_count} words)")

    if total_images == 0:
        issues.append("No images found on page")
    elif missing_alt == 0:
        strengths.append(f"All images have alt text ({total_images} checked)")
    else:
        penalty = min(12, missing_alt * 2)
        score -= penalty
        issues.append(f"{missing_alt} image(s) are missing alt text")

    if internal_links >= 3:
        strengths.append(f"Internal linking is present ({internal_links} internal links)")
    elif internal_links == 0:
        score -= 6
        issues.append("No internal links found")
    else:
        score -= 2
        issues.append(f"Limited internal linking ({internal_links} internal links)")

    if robots_ok:
        strengths.append("robots.txt is available")
    else:
        score -= 6
        issues.append("robots.txt not found or not accessible")

    if sitemap_ok:
        strengths.append("XML sitemap is available")
    else:
        score -= 6
        issues.append("sitemap.xml not found or not accessible")

    score = max(0, min(100, score))
    return score, strengths, issues


def grade_from_score(score: int) -> str:
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 70:
        return "C"
    if score >= 60:
        return "D"
    return "F"


def generate_report(data: Dict) -> str:
    score, strengths, issues = score_report(data)
    grade = grade_from_score(score)
    title_display = data.get("title_text") or "(missing)"
    meta_display = data.get("meta_description") or "(missing)"

    lines = [
        f"# SEO Audit Report: {data['final_url']}",
        "",
        f"- **Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"- **Requested URL:** {data['requested_url']}",
        f"- **Final URL:** {data['final_url']}",
        f"- **HTTP Status:** {data['status_code']}",
        f"- **Overall Score:** **{score}/100** ({grade})",
        "",
        "## Summary",
        "",
        f"- **Title tag:** {'Yes' if data['title_exists'] else 'No'} ({data['title_length']} chars)",
        f"- **Meta description:** {'Yes' if data['meta_description_exists'] else 'No'} ({data['meta_description_length']} chars)",
        f"- **H1 tags:** {data['h1_count']}",
        f"- **H2 tags:** {data['h2_count']}",
        f"- **Images:** {data['image_count']} total / {data['images_missing_alt']} missing alt text",
        f"- **Links:** {data['internal_links']} internal / {data['external_links']} external",
        f"- **Word count:** {data['word_count']}",
        f"- **robots.txt:** {'Found' if data['robots_exists'] else 'Not found'}",
        f"- **sitemap.xml:** {'Found' if data['sitemap_exists'] else 'Not found'}",
        "",
        "## Page Metadata",
        "",
        f"- **Title:** {title_display}",
        f"- **Meta description:** {meta_display}",
        "",
        "## What Looks Good",
        "",
    ]

    if strengths:
        lines.extend([f"- {item}" for item in strengths])
    else:
        lines.append("- No major strengths detected in the quick audit.")

    lines.extend([
        "",
        "## Issues to Review",
        "",
    ])

    if issues:
        lines.extend([f"- {item}" for item in issues])
    else:
        lines.append("- No significant issues found in this quick audit.")

    lines.extend([
        "",
        "## Technical Checks",
        "",
        f"- **robots.txt URL:** {data['robots_url']} ({'OK' if data['robots_exists'] else 'Missing'})",
        f"- **sitemap.xml URL:** {data['sitemap_url']} ({'OK' if data['sitemap_exists'] else 'Missing'})",
        "",
        "## Notes",
        "",
        "- This is a lightweight on-page SEO audit.",
        "- It does not evaluate page speed, schema markup, backlinks, indexing status, Core Web Vitals, or keyword targeting.",
    ])

    return "\n".join(lines) + "\n"


def audit_website(url: str) -> Dict:
    normalized_url = normalize_url(url)
    session = make_session()

    response, html = fetch_url(session, normalized_url)
    soup = BeautifulSoup(html, "html.parser")

    title_tag = soup.title.string.strip() if soup.title and soup.title.string else ""
    meta_description = extract_meta_description(soup)
    h1_count = len(soup.find_all("h1"))
    h2_count = len(soup.find_all("h2"))
    image_count, images_missing_alt = analyze_images(soup)
    internal_links, external_links, _ = analyze_links(soup, response.url)
    word_count = count_words(soup)

    parsed_final = urlparse(response.url)
    base_root = f"{parsed_final.scheme}://{parsed_final.netloc}"
    robots_url = urljoin(base_root, "/robots.txt")
    sitemap_url = urljoin(base_root, "/sitemap.xml")
    robots_exists, robots_status, _ = check_exists(session, robots_url)
    sitemap_exists, sitemap_status, _ = check_exists(session, sitemap_url)

    return {
        "requested_url": normalized_url,
        "final_url": response.url,
        "status_code": response.status_code,
        "title_text": title_tag,
        "title_exists": bool(title_tag),
        "title_length": len(title_tag),
        "meta_description": meta_description,
        "meta_description_exists": bool(meta_description),
        "meta_description_length": len(meta_description),
        "h1_count": h1_count,
        "h2_count": h2_count,
        "image_count": image_count,
        "images_missing_alt": images_missing_alt,
        "internal_links": internal_links,
        "external_links": external_links,
        "word_count": word_count,
        "robots_exists": robots_exists,
        "robots_status": robots_status,
        "robots_url": robots_url,
        "sitemap_exists": sitemap_exists,
        "sitemap_status": sitemap_status,
        "sitemap_url": sitemap_url,
    }


def save_report(report_text: str, filename: str) -> Path:
    output_path = Path.cwd() / filename
    output_path.write_text(report_text, encoding="utf-8")
    return output_path


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python audit.py https://example.com")
        return 1

    raw_url = sys.argv[1]
    try:
        data = audit_website(raw_url)
        report = generate_report(data)
        filename = safe_filename_from_url(data["final_url"])
        output_path = save_report(report, filename)
        print(f"Audit complete: {output_path}")
        print(f"Score: {score_report(data)[0]}/100")
        return 0
    except requests.RequestException as exc:
        print(f"Request failed: {exc}")
        return 2
    except ValueError as exc:
        print(str(exc))
        return 2
    except Exception as exc:
        print(f"Audit failed: {exc}")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
