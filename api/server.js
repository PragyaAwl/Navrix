const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// Google Sheets setup
const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1rEepHIVBCdwsBgpCB7b0B0oNPJsyX00EpyoJx7Zob80';

// In-memory storage for dashboard data
let dashboardData = {
  platinum: [],
  gold: [],
  silver: [],
  unreviewed: []
};

// Function to categorize entries based on score
function categorizeEntry(entry) {
  const score = parseFloat(entry.scores) || 0;
  
  if (score >= 85) return 'platinum';
  if (score >= 70) return 'gold';
  if (score > 0) return 'silver';
  return 'unreviewed';
}

// Function to fetch data from Google Sheets (public sheet)
async function fetchSheetData() {
  try {
    // First try CSV export methods
    const csvUrls = [
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`,
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=tsv&gid=0`,
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=0`
    ];
    
    for (const csvUrl of csvUrls) {
      try {
        console.log('Trying CSV URL:', csvUrl);
        
        const response = await fetch(csvUrl);
        if (response.ok) {
          const csvText = await response.text();
          console.log('CSV data received, length:', csvText.length);
          
          if (csvText && csvText.trim() !== '') {
            return parseCSVData(csvText);
          }
        } else {
          console.log(`CSV failed with status: ${response.status}`);
        }
      } catch (urlError) {
        console.log('CSV URL error:', urlError.message);
      }
    }
    
    // If CSV fails, try scraping the HTML view
    console.log('CSV methods failed, trying HTML scraping...');
    const htmlUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
    
    try {
      const response = await fetch(htmlUrl);
      if (response.ok) {
        const htmlText = await response.text();
        return parseHTMLData(htmlText);
      }
    } catch (htmlError) {
      console.log('HTML scraping failed:', htmlError.message);
    }
    
    console.error('All data fetching methods failed');
    return [];
    
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    return [];
  }
}

// Function to parse CSV data
function parseCSVData(csvText) {
  const rows = [];
  const lines = csvText.split('\n');
  
  for (const line of lines) {
    if (line.trim()) {
      const row = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      row.push(current.trim());
      rows.push(row);
    }
  }

  return processRowData(rows);
}

// Function to parse HTML data (fallback method)
function parseHTMLData(htmlText) {
  console.log('Parsing HTML data...');
  
  const lines = htmlText.split('\n');
  const dataRows = [];
  
  let foundData = false;
  
  for (const line of lines) {
    if (line.includes('Submission ID') && line.includes('Respondent ID')) {
      foundData = true;
      const headers = [
        'Submission ID', 'Respondent ID', 'Submitted at', 'Name of the startup',
        'Founder(s) Name', 'What is your email address?', 'What is your phone number?',
        'Tell us a bit about what you are building.', 'Are you looking to raise funds?',
        'Current Stage?', 'Pitch Deck / White Paper Upload (.pdf preferred)',
        'Anything you would want us to know?', 'Untitled checkboxes field',
        'Untitled checkboxes field', 'Drive Link', 'Scores'
      ];
      dataRows.push(headers);
    } else if (foundData && line.match(/^\d+[A-Za-z0-9]+/)) {
      const rowData = parseDataRow(line);
      if (rowData.length > 10) {
        dataRows.push(rowData);
      }
    }
  }
  
  console.log('Found', dataRows.length, 'rows from HTML parsing');
  return processRowData(dataRows);
}

// Function to parse individual data rows from HTML
function parseDataRow(line) {
  const row = [];
  let remaining = line;
  
  const idMatch = remaining.match(/^(\d+[A-Za-z0-9]+)/);
  if (idMatch) {
    row.push(idMatch[1]);
    remaining = remaining.substring(idMatch[1].length);
  }
  
  const respIdMatch = remaining.match(/^([A-Za-z0-9]+)/);
  if (respIdMatch) {
    row.push(respIdMatch[1]);
    remaining = remaining.substring(respIdMatch[1].length);
  }
  
  const timeMatch = remaining.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
  if (timeMatch) {
    row.push(timeMatch[1]);
    remaining = remaining.substring(timeMatch[1].length);
  }
  
  const nameMatch = remaining.match(/^([^@]+?)([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (nameMatch) {
    row.push(nameMatch[1].trim());
    row.push(nameMatch[1].trim());
    row.push(nameMatch[2]);
    remaining = remaining.substring(nameMatch[0].length - nameMatch[2].length);
  }
  
  const remainingParts = remaining.split(/(?=[A-Z][a-z])|(?=\d{10})|(?=https?:\/\/)/);
  row.push(...remainingParts.slice(0, 10));
  
  return row;
}

// Function to process row data into entries
function processRowData(rows) {
  if (!rows || rows.length === 0) {
    console.log('No rows to process');
    return [];
  }

  console.log('Headers found:', rows[0]);
  console.log('Total rows:', rows.length);

  const headers = rows[0];
  const data = rows.slice(1)
    .filter(row => row.some(cell => cell && cell.trim() !== ''))
    .map(row => {
      const entry = {};
      headers.forEach((header, index) => {
        const key = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
        entry[key] = (row[index] || '').replace(/^"|"$/g, '');
      });
      return entry;
    });

  console.log('Processed entries:', data.length);
  
  console.log('\n=== SUBMISSION IDs FOUND ===');
  data.forEach((entry, index) => {
    const submissionId = entry.submission_id || entry.submission__id || 'No ID';
    const startupName = entry.name_of_the_startup || 'No Name';
    const scores = entry.scores || 'No Score';
    console.log(`${index + 1}. ID: ${submissionId} | Startup: ${startupName} | Score: ${scores}`);
  });
  console.log('============================\n');
  
  return data;
}

// Function to update dashboard data
function updateDashboard(entries) {
  const newDashboardData = {
    platinum: [],
    gold: [],
    silver: [],
    unreviewed: []
  };

  console.log('\n=== CATEGORIZING ENTRIES ===');
  entries.forEach((entry, index) => {
    const category = categorizeEntry(entry);
    const startupName = entry.name_of_the_startup || 'No Name';
    const scores = entry.scores || 'No Score';
    
    console.log(`${index + 1}. ${startupName} | Score: ${scores} | Category: ${category}`);
    newDashboardData[category].push(entry);
  });
  
  console.log('\n=== CATEGORY COUNTS ===');
  console.log(`Platinum: ${newDashboardData.platinum.length}`);
  console.log(`Gold: ${newDashboardData.gold.length}`);
  console.log(`Silver: ${newDashboardData.silver.length}`);
  console.log(`Unreviewed: ${newDashboardData.unreviewed.length}`);
  console.log('==========================\n');

  dashboardData = newDashboardData;
  return true;
}

// API Routes
app.get('/api/dashboard', async (req, res) => {
  try {
    const entries = await fetchSheetData();
    updateDashboard(entries);
    res.json(dashboardData);
  } catch (error) {
    console.error('Error in dashboard API:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = app;