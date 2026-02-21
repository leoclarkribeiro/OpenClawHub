#!/usr/bin/env node
// Generates config.js from environment variables for Vercel deployment
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const config = `// Auto-generated - do not edit. Use env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
window.OPENCLAW_CONFIG = {
  supabaseUrl: "${supabaseUrl}",
  supabaseAnonKey: "${supabaseAnonKey}"
};
`;

const outPath = path.join(__dirname, '..', 'config.js');
fs.writeFileSync(outPath, config);
console.log('Generated config.js');
