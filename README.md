# Ferienhof Wiesengrund

Website für den Ferienhof Wiesengrund — Bauernhofurlaub an der Ostsee.

Built with [Hugo](https://gohugo.io/) + [Tailwind CSS v4](https://tailwindcss.com/), hosted on [Netlify](https://www.netlify.com/).

## Development

```bash
npm install                    # Install Tailwind/PostCSS deps
npm run dev                    # Start Hugo dev server (localhost:1313)
npm run build                  # Production build → public/
```

## Scraper

Scrapes availability data, reviews, and images from landreise.de and the old website.

```bash
cd scraper
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env           # Add landreise.de credentials

python main.py                 # Run all scrapers
python main.py --availability  # Only availability data
python main.py --reviews       # Only reviews
python main.py --images        # Only download images
```

Availability data is automatically updated daily via GitHub Actions.

## Structure

```
content/           Markdown content pages
layouts/           Hugo HTML templates
assets/css/        Tailwind CSS
assets/js/         Calendar + gallery JavaScript
static/images/     Downloaded images from old site
data/              JSON data (reviews, availability)
scraper/           Python scraper for landreise.de
```

