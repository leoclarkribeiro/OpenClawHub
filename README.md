# OpenClaw Hub

Where human lobsters connect. Stay Crusty!

OpenClaw Hub is where human lobsters connect, share experiences, get help and explore the future of personal AI assistants. Plus, organize and join local meetups. [Browse the map](map.html) to find spots near you.

## What is OpenClaw?

[OpenClaw](https://openclaw.ai/) is a personal AI assistant that actually does things. It clears your inbox, sends emails, manages your calendar, checks you in for flights, all from WhatsApp, Telegram, Discord, or any chat app you already use. It runs on your machine, remembers you with persistent memory, and can browse the web, run commands, and extend itself with skills. Your data stays yours. It's open source, hackable, and built by a growing community.

## Features

- **[Map](map.html)** – Browse, add, edit spots (lobsters, meetups, businesses). Click on map to add.
- **[Create / Join community](map.html?filter=meetup)** – Find or add meetup spots.
- **[Help & skills](help.html)** – Ask for help, offer services, post bounties.
- **[Show your creations](creations.html)** – Gallery of community projects.
- **[Events calendar](calendar.html)** – Meetup events by date.

Sign in (email/password) to add content. Anyone can browse.

## Setup

### 1. Supabase

1. Run the SQL in `supabase/schema.sql` in your Supabase project's SQL Editor (includes spots, help_skills, creations tables and event_date column).
2. Create a Storage bucket named `spot-images` (Public: Yes) in Dashboard → Storage.
3. Add a policy: allow public SELECT (read) on `spot-images`.

### 2. Local development

```bash
# Optional: generate config from env vars
export VITE_SUPABASE_URL="https://your-project.supabase.co"
export VITE_SUPABASE_ANON_KEY="your-anon-key"
npm run build
```

Or use the existing `config.js` (already configured for this project).

```bash
python3 -m http.server 8080
```

Then visit http://localhost:8080

### 3. Vercel deployment

Add these environment variables in Vercel:

- `VITE_SUPABASE_URL` – Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` – Your Supabase anon (public) key

The build step generates `config.js` from these env vars.

## Links

- [OpenClaw](https://openclaw.ai/) – Get OpenClaw

Not affiliated with OpenClaw. Built for the community. 🦞
