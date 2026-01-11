const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Google Sheets setup
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

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
  
  // Extract the data from the HTML - this is a simplified approach
  // The data appears to be in a specific format in the HTML
  const lines = htmlText.split('\n');
  const dataRows = [];
  
  // Look for the data pattern we saw in the web fetch
  let foundData = false;
  let currentRow = [];
  
  for (const line of lines) {
    if (line.includes('Submission ID') && line.includes('Respondent ID')) {
      foundData = true;
      // This looks like our header row
      const headerMatch = line.match(/Submission ID.*?Scores/);
      if (headerMatch) {
        // Parse the header
        const headerText = headerMatch[0];
        const headers = [
          'Submission ID', 'Respondent ID', 'Submitted at', 'Name of the startup',
          'Founder(s) Name', 'What is your email address?', 'What is your phone number?',
          'Tell us a bit about what you are building.', 'Are you looking to raise funds?',
          'Current Stage?', 'Pitch Deck / White Paper Upload (.pdf preferred)',
          'Anything you would want us to know?', 'Untitled checkboxes field',
          'Untitled checkboxes field', 'Drive Link', 'Scores'
        ];
        dataRows.push(headers);
      }
    } else if (foundData && line.match(/^\d+[A-Za-z0-9]+/)) {
      // This looks like a data row
      // Parse the data row - this is tricky because it's all concatenated
      // Let's try to split it based on patterns we can identify
      const rowData = parseDataRow(line);
      if (rowData.length > 10) { // Only add if we got reasonable data
        dataRows.push(rowData);
      }
    }
  }
  
  console.log('Found', dataRows.length, 'rows from HTML parsing');
  return processRowData(dataRows);
}

// Function to parse individual data rows from HTML
function parseDataRow(line) {
  // This is a simplified parser for the concatenated data
  // Based on the pattern we saw: ID + timestamp + name + email + phone + etc.
  
  const row = [];
  let remaining = line;
  
  // Extract submission ID (starts with number, then letters)
  const idMatch = remaining.match(/^(\d+[A-Za-z0-9]+)/);
  if (idMatch) {
    row.push(idMatch[1]);
    remaining = remaining.substring(idMatch[1].length);
  }
  
  // Extract respondent ID
  const respIdMatch = remaining.match(/^([A-Za-z0-9]+)/);
  if (respIdMatch) {
    row.push(respIdMatch[1]);
    remaining = remaining.substring(respIdMatch[1].length);
  }
  
  // Extract timestamp (YYYY-MM-DD HH:MM:SS format)
  const timeMatch = remaining.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
  if (timeMatch) {
    row.push(timeMatch[1]);
    remaining = remaining.substring(timeMatch[1].length);
  }
  
  // For the rest, we'll need to make educated guesses based on patterns
  // This is not perfect but should work for basic cases
  
  // Extract startup name (until we hit an email pattern)
  const nameMatch = remaining.match(/^([^@]+?)([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (nameMatch) {
    row.push(nameMatch[1].trim());
    row.push(nameMatch[1].trim()); // Founder name (assuming same for now)
    row.push(nameMatch[2]); // Email
    remaining = remaining.substring(nameMatch[0].length - nameMatch[2].length);
  }
  
  // Add remaining fields as best guess
  const remainingParts = remaining.split(/(?=[A-Z][a-z])|(?=\d{10})|(?=https?:\/\/)/);
  row.push(...remainingParts.slice(0, 10)); // Add up to 10 more fields
  
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
    .filter(row => row.some(cell => cell && cell.trim() !== '')) // Filter out empty rows
    .map(row => {
      const entry = {};
      headers.forEach((header, index) => {
        const key = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
        entry[key] = (row[index] || '').replace(/^"|"$/g, '');
      });
      return entry;
    });

  console.log('Processed entries:', data.length);
  
  // Print submission IDs for debugging
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

  // Check if data has changed
  const hasChanged = JSON.stringify(dashboardData) !== JSON.stringify(newDashboardData);
  
  if (hasChanged) {
    dashboardData = newDashboardData;
    // Emit update to all connected clients
    io.emit('dashboardUpdate', dashboardData);
    console.log('Dashboard updated and broadcasted to clients');
  } else {
    console.log('No changes detected in dashboard data');
  }

  return hasChanged;
}

// Polling function to check for updates
async function pollForUpdates() {
  try {
    const entries = await fetchSheetData();
    updateDashboard(entries);
  } catch (error) {
    console.error('Error polling for updates:', error);
  }
}

// API Routes
app.get('/api/dashboard', (req, res) => {
  res.json(dashboardData);
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send current dashboard data to newly connected client
  socket.emit('dashboardUpdate', dashboardData);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Initialize and start polling
async function initialize() {
  console.log('Initializing dashboard...');
  await pollForUpdates();
  
  // Poll every 10 seconds for updates
  setInterval(pollForUpdates, 10000);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initialize();
});