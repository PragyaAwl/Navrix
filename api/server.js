const express = require('express');
const cors = require('cors');
const { parse } = require('csv-parse/sync');

const app = express();

app.use(cors());
app.use(express.json());

// ================= CONFIG =================

const SHEET_ID =
  process.env.GOOGLE_SHEET_ID ||
  '1rEepHIVBCdwsBgpCB7b0B0oNPJsyX00EpyoJx7Zob80';

// ================= STATE =================

let dashboardData = {
  platinum: [],
  gold: [],
  silver: [],
  unreviewed: []
};

// ================= UTILITIES =================

function normalizeHeader(header) {
  return header
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * THIS IS THE CRITICAL FIX
 * Normalizes every known broken newline Google exports
 */
function normalizeCSV(csvText) {
  return csvText
    // Remove BOM
    .replace(/^\uFEFF/, '')

    // Normalize Windows / Mac newlines
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

    // Normalize Unicode line separators
    .replace(/\u2028/g, '\n')
    .replace(/\u2029/g, '\n');
}

function cleanEntry(entry) {
  for (const key of Object.keys(entry)) {
    if (typeof entry[key] === 'string') {
      entry[key] = entry[key]
        .replace(/^"+|"+$/g, '') // strip outer quotes
        .trim();
    }
  }
  return entry;
}

function categorizeEntry(entry) {
  const score = Number(entry.scores);

  if (!Number.isFinite(score)) return 'unreviewed';
  if (score >= 85) return 'platinum';
  if (score >= 70) return 'gold';
  if (score > 0) return 'silver';
  return 'unreviewed';
}

// ================= GOOGLE SHEETS =================

async function fetchSheetCSV() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch CSV (${res.status})`);
  }

  return await res.text();
}

function parseCSVData(csvText) {
  const normalized = normalizeCSV(csvText);

  // Debug once if needed
  console.log('CSV size (chars):', normalized.length);

  const records = parse(normalized, {
    columns: header => header.map(normalizeHeader),
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true,
    bom: true
  });

  const cleaned = records.map(cleanEntry);

  console.log('Parsed rows:', cleaned.length);
  return cleaned;
}

// ================= DASHBOARD =================

function updateDashboard(entries) {
  const next = {
    platinum: [],
    gold: [],
    silver: [],
    unreviewed: []
  };

  console.log('\n=== CATEGORIZATION ===');

  entries.forEach((entry, i) => {
    const category = categorizeEntry(entry);
    const name = entry.name_of_the_startup || 'No Name';
    const score = entry.scores ?? 'No Score';

    console.log(
      `${i + 1}. ${name} | Score: ${score} → ${category}`
    );

    next[category].push(entry);
  });

  console.log('\n=== TOTALS ===');
  Object.entries(next).forEach(
    ([k, v]) => console.log(`${k}: ${v.length}`)
  );
  console.log('================\n');

  dashboardData = next;
}

// ================= ROUTES =================

app.get('/api/dashboard', async (req, res) => {
  try {
    const csvText = await fetchSheetCSV();
    const entries = parseCSVData(csvText);
    updateDashboard(entries);
    res.json(dashboardData);
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// ================= EXPORT =================

module.exports = app;
