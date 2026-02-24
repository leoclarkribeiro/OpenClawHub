#!/usr/bin/env node
/**
 * Generates static SEO pages from Supabase spots data:
 * - locations/[city-slug].html - Location pages with spots listed
 * - builders.html, meetups.html, businesses.html - Category pages
 * - Updates sitemap.xml with new URLs
 *
 * Requires: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (or SUPABASE_*)
 */
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.openclawmap.wtf';
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const CATEGORIES = {
  lobster: { label: 'Human Lobster / Builder', icon: '🦞', slug: 'builders' },
  meetup: { label: 'Meetup & IRL Event', icon: '🏠', slug: 'meetups' },
  business: { label: 'Business', icon: '💰', slug: 'businesses' }
};

function slugify(s) {
  if (!s || typeof s !== 'string') return 'unknown';
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';
}

/** Normalize city for grouping: "San Francisco, CA" → "San Francisco". Produces cleaner slugs. */
function primaryCity(city) {
  if (!city || typeof city !== 'string') return 'Unknown';
  const trimmed = city.trim();
  const commaIdx = trimmed.indexOf(',');
  if (commaIdx > 0) return trimmed.slice(0, commaIdx).trim();
  if (/\b(bay area|metro|greater)\b/i.test(trimmed)) {
    const m = trimmed.match(/^(.+?)\s+(bay area|metro|greater)/i);
    if (m) return m[1].trim();
  }
  return trimmed || 'Unknown';
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const PAGE_TEMPLATE = (opts) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(opts.title)}</title>
  <meta name="description" content="${escapeHtml(opts.description)}">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🦞</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root { --muted: #8B7F77; --accent: #FF5A2D; --accent-bright: #FF7A3D; --bg-dark: #0d0c0b; --bg-card: #161412; --text: #e8e4e0; --text-muted: #8B7F77; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: var(--bg-dark); color: var(--text); min-height: 100vh; line-height: 1.6; }
    .container { max-width: 720px; margin: 0 auto; padding: 1.5rem; padding-top: 4rem; }
    .page-header { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: var(--bg-card); border-bottom: 1px solid rgba(255, 90, 45, 0.2); padding: 0.6rem 1rem; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; }
    .page-header .header-center { justify-self: center; }
    .page-header a { color: var(--accent); text-decoration: none; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; }
    .page-header h1 { font-family: 'JetBrains Mono', monospace; font-size: 1rem; font-weight: 600; }
    .page-header h1 .beta { font-size: 0.65rem; font-weight: 400; color: var(--muted); margin-left: 0.5rem; }
    .menu-trigger { background: var(--bg-card); border: 1px solid rgba(255, 90, 45, 0.2); border-radius: 6px; padding: 0.35rem 0.6rem; font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--accent); cursor: pointer; }
    .menu-panel { position: fixed; top: 52px; left: 1rem; z-index: 99; background: var(--bg-card); border: 1px solid rgba(255, 90, 45, 0.2); border-radius: 10px; padding: 0.35rem 0; min-width: 240px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); display: none; }
    .menu-panel.open { display: block; }
    .menu-panel a { display: block; padding: 0.3rem 0.6rem; font-size: 0.8rem; color: var(--text-muted); text-decoration: none; }
    .menu-panel a:hover { color: var(--text); background: rgba(255, 90, 45, 0.06); }
    .menu-overlay { position: fixed; inset: 0; z-index: 98; background: transparent; display: none; }
    .menu-overlay.open { display: block; }
    h2 { font-size: 1.25rem; margin: 1.5rem 0 0.75rem; color: var(--accent); }
    .spot-list { list-style: none; }
    .spot-list li { background: var(--bg-card); border: 1px solid rgba(255, 90, 45, 0.12); border-radius: 8px; padding: 1rem; margin-bottom: 0.5rem; }
    .spot-list li a { color: var(--accent); }
    .spot-list .meta { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem; }
    .cta { display: inline-block; margin-top: 1.5rem; padding: 0.5rem 1rem; background: var(--accent); color: white; border-radius: 6px; text-decoration: none; font-size: 0.9rem; }
    .cta:hover { background: var(--accent-bright); }
  </style>
</head>
<body>
  <header class="page-header">
    <div><button type="button" class="menu-trigger" id="menu-trigger" aria-expanded="false">☰ Menu</button></div>
    <h1 class="header-center">🦞 OpenClaw Map <span class="beta">Beta v0.4</span></h1>
    <div>    <a href="${opts.basePath}index.html">Map</a></div>
  </header>
  <div class="menu-overlay" id="menu-overlay"></div>
  <nav class="menu-panel" id="menu-panel">
    <a href="${opts.basePath}index.html">Browse the map</a>
    <a href="${opts.basePath}index.html?filter=meetup">Create / Join community</a>
    <a href="${opts.basePath}help.html">Help & skills</a>
    <a href="${opts.basePath}creations.html">Show your creations</a>
    <a href="${opts.basePath}calendar.html">Events calendar</a>
    <a href="${opts.basePath}about.html">About</a>
  </nav>
  <main class="container">
    ${opts.content}
    <a href="${opts.basePath}index.html" class="cta">View on interactive map →</a>
  </main>
  <script>
    (function(){var t=document.getElementById('menu-trigger'),p=document.getElementById('menu-panel'),o=document.getElementById('menu-overlay');
    t&&t.addEventListener('click',function(){p.classList.toggle('open');o.classList.toggle('open');});
    o&&o.addEventListener('click',function(){p.classList.remove('open');o.classList.remove('open');});})();
  </script>
</body>
</html>`;

async function fetchSpots() {
  const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/spots?select=*&order=created_at.desc`;
  const res = await fetch(url, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`);
  return res.json();
}

function renderSpotItem(spot, basePath = '') {
  const cat = CATEGORIES[spot.category];
  const icon = cat?.icon || '📍';
  return `<li><a href="${basePath}index.html">${icon} ${escapeHtml(spot.name)}</a>${spot.description ? `<p class="meta">${escapeHtml(spot.description)}</p>` : ''}<span class="meta">${escapeHtml(spot.city)}</span></li>`;
}

async function main() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.log('Skipping SEO page generation (no Supabase config)');
    return;
  }

  const root = path.join(__dirname, '..');
  const locationsDir = path.join(root, 'locations');
  if (!fs.existsSync(locationsDir)) fs.mkdirSync(locationsDir, { recursive: true });

  let spots = [];
  try {
    spots = await fetchSpots();
  } catch (err) {
    console.warn('Could not fetch spots for SEO pages:', err.message);
    return;
  }

  const byCity = {};
  const byCategory = { lobster: [], meetup: [], business: [] };

  for (const s of spots) {
    const rawCity = (s.city || '').trim() || 'Unknown';
    const city = primaryCity(rawCity);
    if (!byCity[city]) byCity[city] = [];
    byCity[city].push(s);
    if (byCategory[s.category]) byCategory[s.category].push(s);
  }

  const sitemapUrls = [
    { loc: `${BASE_URL}/`, changefreq: 'weekly', priority: '1.0' },
    { loc: `${BASE_URL}/index.html`, changefreq: 'weekly', priority: '1.0' },
    { loc: `${BASE_URL}/about.html`, changefreq: 'monthly', priority: '0.8' },
    { loc: `${BASE_URL}/calendar.html`, changefreq: 'weekly', priority: '0.9' },
    { loc: `${BASE_URL}/help.html`, changefreq: 'weekly', priority: '0.8' },
    { loc: `${BASE_URL}/creations.html`, changefreq: 'weekly', priority: '0.8' },
    { loc: `${BASE_URL}/index.html?filter=meetup`, changefreq: 'weekly', priority: '0.9' }
  ];

  for (const [city, citySpots] of Object.entries(byCity)) {
    const slug = slugify(city);
    const lobsterSpots = citySpots.filter(s => s.category === 'lobster');
    const meetupSpots = citySpots.filter(s => s.category === 'meetup');
    const businessSpots = citySpots.filter(s => s.category === 'business');

    let content = `<h1>OpenClaw Map – ${escapeHtml(city)}</h1><p>Find Human Lobsters, meetups, and businesses in ${escapeHtml(city)}. <a href="../index.html">View on the interactive map</a>.</p>`;
    const bp = '../';
    if (lobsterSpots.length) {
      content += `<h2>🦞 Human Lobsters / Builders</h2><ul class="spot-list">${lobsterSpots.map(s => renderSpotItem(s, bp)).join('')}</ul>`;
    }
    if (meetupSpots.length) {
      content += `<h2>🏠 Meetups & IRL Events</h2><ul class="spot-list">${meetupSpots.map(s => renderSpotItem(s, bp)).join('')}</ul>`;
    }
    if (businessSpots.length) {
      content += `<h2>💰 Businesses</h2><ul class="spot-list">${businessSpots.map(s => renderSpotItem(s, bp)).join('')}</ul>`;
    }

    const html = PAGE_TEMPLATE({
      title: `OpenClaw Map – ${city} | Builders, Meetups & Businesses`,
      description: `Find OpenClaw builders, meetups, and businesses in ${city}. Connect with the Human Lobster community.`,
      content,
      basePath: '../'
    });
    fs.writeFileSync(path.join(locationsDir, `${slug}.html`), html);
    sitemapUrls.push({ loc: `${BASE_URL}/locations/${slug}.html`, changefreq: 'weekly', priority: '0.7' });
  }

  for (const [catKey, catSpots] of Object.entries(byCategory)) {
    const cat = CATEGORIES[catKey];
    if (!cat || catSpots.length === 0) continue;
    const slug = cat.slug;
    const content = `<h1>${cat.icon} ${escapeHtml(cat.label)}</h1><p>Browse ${catSpots.length} ${cat.label.toLowerCase()} on the OpenClaw Map.</p><ul class="spot-list">${catSpots.map(s => renderSpotItem(s, '')).join('')}</ul>`;
    const html = PAGE_TEMPLATE({
      title: `OpenClaw Map – ${cat.label}`,
      description: `Find ${cat.label.toLowerCase()} on the OpenClaw community map. Connect with builders and the Human Lobster community worldwide.`,
      content,
      basePath: ''
    });
    fs.writeFileSync(path.join(root, `${slug}.html`), html);
    sitemapUrls.push({ loc: `${BASE_URL}/${slug}.html`, changefreq: 'weekly', priority: '0.8' });
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(u => `  <url><loc>${u.loc}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;
  fs.writeFileSync(path.join(root, 'sitemap.xml'), sitemap);

  console.log(`Generated ${Object.keys(byCity).length} location pages, 3 category pages, updated sitemap.xml`);
}

main().catch(err => {
  console.error('SEO page generation failed:', err);
  process.exit(1);
});
