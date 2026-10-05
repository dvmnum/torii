# Torii — Chrome Web Store listing (English)

The store takes the name and short description from the extension (`plitka/_locales/en/messages.json`):
- **Name:** Torii — New Tab
- **Short description:** A new tab with a free-form layout: drag and resize widgets anywhere. Live backgrounds, glass, saved layouts.

Screenshots — `store/screenshots/en/` (1280×800, in this order), small promo tile — `store/promo-440x280-en.png`, marquee (1400×560) — `store/marquee-1400x560-en.png`.
Rebuild: `npm run store`.

---

## Detailed description

Torii turns your new tab into a personal dashboard — laid out by you, not by a template.

FREE-FORM LAYOUT
What sets Torii apart from other new tab pages: widgets aren't stuck in a single centered column. Drag them anywhere and resize them from any corner — the grid keeps everything neatly aligned. Layouts for wide monitors and laptops are remembered separately.

WIDGETS
• Clock — digital or analog, with a greeting and the date
• Search — uses your browser's default search engine (or another one you pick), quick prefixes for a one-off search elsewhere, a calculator right in the search bar, Shift+Enter to search in incognito
• Links and Top sites — as tiles or a list, with site icons
• Bookmarks bar — your bookmarks right on the new tab
• Weather — now, details, hourly or for the week
• Notes, to-do list, weekly habit tracker
• Pomodoro timer, countdown to an event
• Picture (cats, anime GIFs or your own), recently closed tabs

LIVE BACKGROUNDS
Smooth animated gradients with 14 presets and a color editor. Or your own image — as is or with an effect: frosted glass, reeded glass, halftone, duotone. Effects on top: vignette, glow, particles, cursor parallax, a tint that follows the time of day. A slideshow of your own backgrounds.

GLASS
Frosted-glass widgets that adapt their brightness to the background so text stays readable. In Chrome there's also "liquid glass" with refraction at the edges. Each widget can have its own color, font, shadow and backing.

SAVED LAYOUTS
Keep several versions of your new tab — "Work", "Home", "Study" — and switch with Alt+1…9. Each layout has its own widgets, background and style.

FAST AND PRIVATE
• Opens instantly; heavy parts load only when you need them
• No ads, no analytics, no data collection — everything stays in your browser
• Backup to a file to move everything to another computer
• Access to bookmarks, top sites and recent tabs is requested only when you add such a widget
• English and Russian interface

---

## Privacy practices tab

**Single purpose:**
Torii replaces the new tab page with a customizable dashboard of widgets (clock, search, links, weather, notes and more) that the user arranges and styles.

**Permission justifications:**
- `storage` — stores settings, widgets and their layout in the user's browser.
- `search` — the search bar on the new tab searches with the user's default search engine via the Chrome Search API (`chrome.search.query`); the extension does not change the browser's search settings.
- `unlimitedStorage` — a custom background image and slideshow images take several megabytes and don't fit the default storage quota.
- `topSites` (optional) — the "Top sites" widget shows the user's most visited sites. Requested only when this widget is added.
- `sessions` (optional) — the "Recently closed" widget lists and restores recently closed tabs. Requested only when this widget is added.
- `tabs` (optional) — needed by the "Recently closed" widget to show the URL and title of closed tabs (without it the browser returns them empty). Requested together with `sessions`.
- `bookmarks` (optional) — the "Bookmarks bar" widget shows the user's bookmarks bar; the "Links" widget offers a one-time import from bookmarks. Requested only when used.

**Remote code:** No. All scripts, fonts and libraries are bundled with the extension.

**Data usage:** the Chrome Web Store requires disclosing data even if it's only handled locally. Check:
- **Personally identifiable information** — the name for the greeting (stored only in the browser).
- **Location** — the city for the weather (sent to Open-Meteo).
- **Web history** — top sites, recently closed tabs, bookmarks (shown only on the new tab; site addresses go to icon services).

Leave the rest unchecked. Confirm all three compliance statements: data isn't sold or transferred except to provide the features themselves.

**Privacy policy:** text in `store/privacy-policy.md`; host it at a public URL (GitHub Pages, a gist, Telegraph) and paste the link.

---

## Other fields
- **Category:** Productivity → Workflow & Planning (or Tools)
- **Default language:** English (`default_locale: en`), Russian as an additional language
- **Visibility:** Public
