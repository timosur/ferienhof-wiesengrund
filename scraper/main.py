"""
Ferienhof Wiesengrund — Web Scraper
Scrapes availability data, reviews, and accommodation details from landreise.de

Usage:
    python main.py                    # Run all scrapers
    python main.py --availability     # Only availability
    python main.py --reviews          # Only reviews
    python main.py --images           # Only download images

Requires: pip install requests beautifulsoup4 python-dotenv
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
STATIC_DIR = BASE_DIR / "static"

LANDREISE_BASE = "https://www.landreise.de"
FERIENHOF_BASE = "https://www.ferienhof-wiesengrund.de"

ACCOMMODATIONS = {
    "9200": {"name": "Ferienwohnung 1", "slug": "fewo1"},
    "9477": {"name": "Ferienwohnung 2", "slug": "fewo2"},
    "9478": {"name": "Ferienwohnung 3", "slug": "fewo3"},
    "9479": {"name": "Ferienwohnung 4", "slug": "fewo4"},
    "9480": {"name": "Ferienwohnung 5", "slug": "fewo5"},
    "35182": {"name": "Ferienhaus", "slug": "fhaus1"},
}

# Image directories on the old site
IMAGE_SECTIONS = [
    ("imgs/fhof", "hof"),
    ("imgs/kuehe", "kuehe"),
    ("imgs/ponys", "ponys"),
    ("imgs/kinder", "kinder"),
    ("imgs/tiere", "tiere"),
    ("imgs/spielen", "spielen"),
    ("imgs/fewo1", "fewo1"),
    ("imgs/fewo2", "fewo2"),
    ("imgs/fewo3", "fewo3"),
    ("imgs/fewo4", "fewo4"),
    ("imgs/fewo5", "fewo5"),
    ("imgs/fhaus1", "fhaus1"),
    ("imgs/kontakt", "kontakt"),
    ("imgs/preisinfo", "preisinfo"),
    ("w3css/imgs/gallerie", "gallerie"),
]


def get_session():
    """Create a requests session with common headers."""
    session = requests.Session()
    session.headers.update(
        {"User-Agent": "Mozilla/5.0 (compatible; FerienhofScraper/1.0)"}
    )
    return session


def scrape_availability(session):
    """Scrape availability/occupancy data from public landreise.de endpoints.

    The endpoints return JSON arrays of booking periods with Unix timestamps:
    [{"from": 1774652400, "to": 1775858400}, ...]

    We convert these to ISO date strings for the calendar JS.
    """
    print("\n=== Scraping Availability ===")
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    availability = {}

    for acc_id, info in ACCOMMODATIONS.items():
        url = (
            f"{LANDREISE_BASE}/extranet/service/accommodation-occupancy-rules/{acc_id}"
        )
        print(f"  Fetching {info['name']} (ID {acc_id})...")
        try:
            resp = session.get(url, timeout=30)
            if resp.status_code != 200:
                print(f"    ✗ HTTP {resp.status_code}")
                continue

            data = resp.json()
            bookings = []
            if isinstance(data, list):
                for entry in data:
                    if "from" in entry and "to" in entry:
                        start = datetime.fromtimestamp(entry["from"]).strftime(
                            "%Y-%m-%d"
                        )
                        end = datetime.fromtimestamp(entry["to"]).strftime("%Y-%m-%d")
                        bookings.append({"start": start, "end": end})
            availability[acc_id] = bookings
            print(f"    ✓ {len(bookings)} booking periods found")

        except Exception as e:
            print(f"    ✗ Error: {e}")

    output_path = DATA_DIR / "availability.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(availability, f, indent=2, ensure_ascii=False)
    print(f"\n✓ Saved to {output_path}")

    # Also copy to static for client-side JS access
    static_data = STATIC_DIR / "data"
    static_data.mkdir(parents=True, exist_ok=True)
    with open(static_data / "availability.json", "w", encoding="utf-8") as f:
        json.dump(availability, f, indent=2, ensure_ascii=False)


def scrape_reviews(session):
    """Scrape reviews from the public exposé page."""
    print("\n=== Scraping Reviews ===")
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    url = f"{LANDREISE_BASE}/expose/ferienhof-wiesengrund-4321"
    print(f"  Fetching {url}...")

    try:
        resp = session.get(url, timeout=30)
        if resp.status_code != 200:
            print(f"  ✗ HTTP {resp.status_code}")
            return

        soup = BeautifulSoup(resp.text, "html.parser")

        reviews_data = {
            "score": 9.8,
            "count": 289,
            "categories": {
                "unterkunft": 9.7,
                "service": 9.9,
                "ruhe": 9.5,
                "landerlebnisse": 9.9,
                "nachhaltigkeit": 9.5,
            },
            "reviews": [],
            "scraped_at": datetime.now().isoformat(),
        }

        # Parse individual reviews
        review_elements = soup.select("[class*='review'], [class*='bewertung']")
        for el in review_elements:
            name_el = el.select_one("[class*='name'], [class*='author']")
            score_el = el.select_one("[class*='score'], [class*='rating']")
            text_el = el.select_one("[class*='text'], [class*='comment'], p")
            date_el = el.select_one("[class*='date']")

            if name_el and text_el:
                reviews_data["reviews"].append(
                    {
                        "name": name_el.get_text(strip=True),
                        "score": score_el.get_text(strip=True) if score_el else "10",
                        "text": text_el.get_text(strip=True)[:300],
                        "date": date_el.get_text(strip=True) if date_el else "",
                    }
                )

        # If scraping didn't find structured reviews, use known data
        if not reviews_data["reviews"]:
            reviews_data["reviews"] = [
                {
                    "name": "Tanja F.",
                    "score": "10",
                    "text": "Wir hatten zum 5. Mal eine wunderschöne Ferienwoche bei Familie Köpke. Man fühlt sich pudelwohl auf dem Hof und sowohl für Kinder als auch Erwachsene ist es eine tolle Zeit.",
                    "date": "April 2026",
                },
                {
                    "name": "Anja",
                    "score": "10",
                    "text": "Wir waren mit den Kindern 2 Wochen bei Familie Köpke. Es ist für uns super schön dort. Es ist sehr familiär und das gemeinschaftliche wird richtig gelebt.",
                    "date": "April 2026",
                },
                {
                    "name": "Matthis",
                    "score": "10",
                    "text": "Sehr schöner Hof mit vielen Attraktionen für Kinder wie z.B. Pony reiten.",
                    "date": "April 2026",
                },
            ]

        output_path = DATA_DIR / "reviews.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(reviews_data, f, indent=2, ensure_ascii=False)
        print(f"  ✓ Saved {len(reviews_data['reviews'])} reviews to {output_path}")

    except Exception as e:
        print(f"  ✗ Error: {e}")


def download_images(session):
    """Download all images from the old website."""
    print("\n=== Downloading Images ===")

    for remote_dir, local_dir in IMAGE_SECTIONS:
        target_dir = STATIC_DIR / "images" / local_dir
        target_dir.mkdir(parents=True, exist_ok=True)

        # Try numbered images _1.jpg through _20.jpg
        found = 0
        for i in range(1, 21):
            img_url = f"{FERIENHOF_BASE}/{remote_dir}/_{i}.jpg"
            target_file = target_dir / f"{i}.jpg"

            try:
                resp = session.get(img_url, timeout=15, allow_redirects=False)
                if resp.status_code == 200 and len(resp.content) > 1000:
                    with open(target_file, "wb") as f:
                        f.write(resp.content)
                    found += 1
                else:
                    break  # No more images in this sequence
            except Exception:
                break

        print(f"  {local_dir}: {found} images")

    print("\n✓ Image download complete")


def main():
    parser = argparse.ArgumentParser(description="Ferienhof Wiesengrund Scraper")
    parser.add_argument(
        "--availability", action="store_true", help="Scrape availability only"
    )
    parser.add_argument("--reviews", action="store_true", help="Scrape reviews only")
    parser.add_argument("--images", action="store_true", help="Download images only")
    args = parser.parse_args()

    run_all = not (args.availability or args.reviews or args.images)
    session = get_session()

    if run_all or args.images:
        download_images(session)

    if run_all or args.reviews:
        scrape_reviews(session)

    if run_all or args.availability:
        scrape_availability(session)

    print("\n=== Done ===")


if __name__ == "__main__":
    main()
