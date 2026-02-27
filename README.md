# OpenClaw Map

Where human lobsters connect. Stay Crusty!

OpenClaw Map is where human lobsters connect, share experiences, get help and explore the future of personal AI assistants. Plus, organize and join local meetups. [Browse the map](index.html) to find spots near you.

## What is OpenClaw?

[OpenClaw](https://openclaw.ai/) is a personal AI assistant that actually does things. It clears your inbox, sends emails, manages your calendar, checks you in for flights, all from WhatsApp, Telegram, Discord, or any chat app you already use. It runs on your machine, remembers you with persistent memory, and can browse the web, run commands, and extend itself with skills. Your data stays yours. It's open source, hackable, and built by a growing community.

## Features

- **[Map](index.html)** – Browse, add, edit spots (lobsters, meetups, businesses). Click on map to add.
- **[Create / Join community](index.html?filter=meetup)** – Find or add meetup spots.
- **[Help & skills](help.html)** – Ask for help, offer services, post bounties.
- **[Show your creations](creations.html)** – Gallery of community projects.
- **[Events calendar](calendar.html)** – Meetup events by date.

Add spots as a guest (no signup) or sign in to create an account. Anyone can browse.

## Setup

### 1. Supabase

1. Run the SQL in `supabase/schema.sql` in your Supabase project's SQL Editor (includes spots, help_skills, creations tables, event_date, and x_profile columns).
2. Create a Storage bucket named `spot-images` (Public: Yes) in Dashboard → Storage.
3. Run `supabase/storage-policies.sql` in the SQL Editor to add upload and read policies.
4. **Anonymous Auth**: In Supabase Dashboard → Authentication → Providers → enable **Anonymous** (allows "Add as guest" without signup).
5. **Manual Linking** (for converting guests to accounts): In Supabase Dashboard → Authentication → Providers → enable **Manual linking** (or set `GOTRUE_SECURITY_MANUAL_LINKING_ENABLED: true` when self-hosting). This lets guests link an email and convert to a permanent account while keeping their spots.
6. **Redirect URLs**: In Supabase Dashboard → Authentication → URL Configuration → Redirect URLs, add your site URLs (e.g. `https://www.openclawmap.wtf`, `http://localhost:8080`) so email verification links redirect correctly.
7. **Google Maps**: Enable Maps JavaScript API and Geocoding API in [Google Cloud Console](https://console.cloud.google.com/). Add your API key to `config.js` as `googleMapsApiKey`, or set `VITE_GOOGLE_MAPS_API_KEY` for Vercel builds. Restrict the key by HTTP referrer in production.

### 2. Local development

```bash
# Optional: generate config from env vars
export VITE_SUPABASE_URL="https://your-project.supabase.co"
export VITE_SUPABASE_ANON_KEY="your-anon-key"
npm run build
```

Or copy `config.example.js` to `config.js` and add your Google Maps API key. (`config.js` is gitignored.)

```bash
python3 -m http.server 8080
```

Then visit http://localhost:8080

### 3. Vercel deployment

Add these environment variables in Vercel:

- `VITE_SUPABASE_URL` – Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` – Your Supabase anon (public) key
- `VITE_GOOGLE_MAPS_API_KEY` – Your Google Maps API key (Maps JavaScript API + Geocoding API)

The build step generates `config.js` from these env vars. It also runs `scripts/generate-seo-pages.js`, which fetches spots from Supabase and generates static location pages (`locations/[city].html`) and category pages (`builders.html`, `meetups.html`, `businesses.html`) for SEO.

### 4. SEO

- **Sitemap**: `sitemap.xml` is generated at build time. Submit `https://www.openclawmap.wtf/sitemap.xml` to [Google Search Console](https://search.google.com/search-console).
- **robots.txt**: References the sitemap. Ensure it's accessible at `/robots.txt`.
- **Schema markup**: WebSite, Organization (index), Event (calendar). Events are injected client-side when the calendar loads.
- **Static pages**: Location and category pages are plain HTML with crawlable text. Update `BASE_URL` in `scripts/generate-seo-pages.js` if your domain differs.

### 5. Custom domains (Vercel)

1. In Vercel Dashboard → Project → **Settings** → **Domains**
2. Add `www.openclawmap.wtf` – Vercel will show DNS records (CNAME to `cname.vercel-dns.com`)
3. In your domain registrar (e.g. Namecheap, Cloudflare), add the CNAME record for `www` → `cname.vercel-dns.com`
4. Set `www.openclawmap.wtf` as the **primary** domain (Vercel → Domains → ⋮ next to domain → "Set as Primary")
5. Keep `www.openclawhub.wtf` if desired – add it as an alias; both will point to the same deployment

**Google Maps API key:** Add `www.openclawmap.wtf/*` and `*.openclawmap.wtf/*` to HTTP referrer restrictions in Google Cloud Console.

## Links

- [OpenClaw](https://openclaw.ai/) – Get OpenClaw

Not affiliated with OpenClaw. Built for the community. 🦞
