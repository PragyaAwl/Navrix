const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { validateEntry } = require('../validation');
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
  // Pre-validation before categorization
  if (!validateEntry(entry)) {
    console.warn('Attempting to categorize invalid entry:', entry);
    return null; // Return null for invalid entries
  }
  
  // Simple score handling - if no score or invalid score, go to unreviewed
  const scoreValue = entry.scores;
  
  // Check if score exists and is valid
  if (!scoreValue || scoreValue === '' || scoreValue === null || scoreValue === undefined) {
    return 'unreviewed';
  }
  
  const parsedScore = parseFloat(scoreValue);
  
  // Check if the parsed score is a valid number
  if (isNaN(parsedScore) || !isFinite(parsedScore)) {
    console.warn('Invalid score format:', scoreValue, 'for entry:', entry.name_of_the_startup || entry.submission_id);
    return 'unreviewed';
  }
  
  // Ensure score is within reasonable bounds (0-100)
  if (parsedScore < 0 || parsedScore > 100) {
    console.warn('Score out of bounds (0-100):', parsedScore, 'for entry:', entry.name_of_the_startup || entry.submission_id);
    return 'unreviewed';
  }
  
  // Categorize based on validated score
  if (parsedScore >= 85) return 'platinum';
  if (parsedScore >= 70) return 'gold';
  if (parsedScore > 0) return 'silver';
  return 'unreviewed';
}

// Function to fetch data from Google Sheets (public sheet)
async function fetchSheetData() {
  try {
    // First try CSV export methods with aggressive cache busting
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const csvUrls = [
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0&cachebust=${timestamp}&rand=${random}&t=${Date.now()}`,
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=tsv&gid=0&cachebust=${timestamp}&rand=${random}&t=${Date.now()}`,
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=0&cachebust=${timestamp}&rand=${random}&t=${Date.now()}&headers=1`
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

// Function to process row data into entries
function processRowData(rows) {
  if (!rows || rows.length === 0) {
    console.log('No rows to process');
    return [];
  }

  console.log('Headers found:', rows[0]);
  console.log('Total rows:', rows.length);
  
  const headers = rows[0];
  console.log('\n=== HEADER MAPPING DEBUG ===');
  headers.forEach((header, index) => {
    const key = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
    console.log(`${index}: "${header}" -> "${key}"`);
  });
  console.log('===============================\n');

  const data = rows.slice(1)
    .filter(row => row.some(cell => cell && cell.trim() !== '')) // Filter out empty rows
    .map((row, rowIndex) => {
      const entry = {};
      
      // Ensure row has same length as headers by padding with empty strings
      const paddedRow = [...row];
      while (paddedRow.length < headers.length) {
        paddedRow.push('');
      }
      
      headers.forEach((header, index) => {
        const key = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const value = (paddedRow[index] || '').replace(/^"|"$/g, '');
        entry[key] = value;
      });
      
      return entry;
    });

  console.log('Processed entries:', data.length);
  
  // SIMPLIFIED SCORE HANDLING
  console.log('\n=== SCORE PROCESSING ===');
  
  // Count entries with and without scores
  const entriesWithScores = data.filter(entry => 
    entry.scores && 
    entry.scores !== '' && 
    entry.scores !== null && 
    entry.scores !== undefined &&
    !isNaN(parseFloat(entry.scores))
  );
  
  const entriesWithoutScores = data.filter(entry => 
    !entry.scores || 
    entry.scores === '' || 
    entry.scores === null || 
    entry.scores === undefined ||
    isNaN(parseFloat(entry.scores))
  );
  
  console.log(`Entries with valid scores: ${entriesWithScores.length}`);
  console.log(`Entries without scores (will go to unreviewed): ${entriesWithoutScores.length}`);
  
  // Log entries without scores for debugging
  if (entriesWithoutScores.length > 0) {
    console.log('Entries going to unreviewed category:');
    entriesWithoutScores.forEach(entry => {
      const name = entry.name_of_the_startup || 'No Name';
      const id = entry.submission_id || 'No ID';
      console.log(`  - ${name} (ID: ${id})`);
    });
  }
  
  console.log('========================\n');
  
  return data;
}

// Function to update dashboard data
function updateDashboard(entries) {
  try {
    // Validate input
    if (!entries || !Array.isArray(entries)) {
      console.warn('Invalid entries data provided to updateDashboard, using empty array');
      entries = [];
    }
    
    // Clear existing state first - atomic state replacement
    const newDashboardData = {
      platinum: [],
      gold: [],
      silver: [],
      unreviewed: []
    };

    console.log('Processing entries for dashboard update...');
    
    // Filter and validate entries first
    const validatedEntries = [];
    
    entries.forEach((entry, index) => {
      try {
        const isValid = validateEntry(entry);
        
        if (isValid) {
          validatedEntries.push(entry);
        } else {
          console.log(`Filtering out invalid entry ${index + 1}: ${entry.name_of_the_startup || entry.submission_id || 'No identifier'}`);
        }
      } catch (entryError) {
        console.warn(`Error processing entry ${index + 1}, skipping:`, entryError.message);
      }
    });

    console.log(`\n=== VALIDATION RESULTS ===`);
    console.log(`Total entries received: ${entries.length}`);
    console.log(`Valid entries after filtering: ${validatedEntries.length}`);
    console.log(`Invalid entries filtered out: ${entries.length - validatedEntries.length}`);
    console.log('============================\n');

    console.log('\n=== CATEGORIZING ENTRIES ===');
    // Rebuild categories from scratch with only validated entries
    validatedEntries.forEach((entry, index) => {
      try {
        const category = categorizeEntry(entry);
        
        // Skip entries that couldn't be categorized (returned null)
        if (category === null) {
          console.warn(`Skipping entry that failed categorization: ${entry.name_of_the_startup || entry.submission_id}`);
          return;
        }
        
        const startupName = entry.name_of_the_startup || 'No Name';
        const scores = entry.scores || 'No Score';
        
        console.log(`${index + 1}. ${startupName} | Score: ${scores} | Category: ${category}`);
        
        newDashboardData[category].push(entry);
      } catch (categorizationError) {
        console.warn(`Error categorizing entry, skipping:`, categorizationError.message);
      }
    });
    
    console.log('\n=== CATEGORY COUNTS ===');
    console.log(`Platinum: ${newDashboardData.platinum.length}`);
    console.log(`Gold: ${newDashboardData.gold.length}`);
    console.log(`Silver: ${newDashboardData.silver.length}`);
    console.log(`Unreviewed: ${newDashboardData.unreviewed.length}`);
    console.log('==========================\n');

    // Atomic state replacement - replace entire state at once
    dashboardData = newDashboardData;
    
    // Emit update to all connected clients
    io.emit('dashboardUpdate', dashboardData);
    console.log('✅ Dashboard updated and broadcasted to clients');

    return true;
    
  } catch (error) {
    console.error('Critical error in updateDashboard:', error);
    console.error('Dashboard update failed, maintaining current state');
    return false;
  }
}

// API Routes
app.get('/api/dashboard', async (req, res) => {
  try {
    const entries = await fetchSheetData();
    updateDashboard(entries);
    res.json(dashboardData);
  } catch (error) {
    console.error('Error in dashboard endpoint:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch dashboard data',
      message: error.message 
    });
  }
});

// Manual refresh endpoint for immediate updates
app.post('/api/refresh', async (req, res) => {
  try {
    console.log('🔄 Manual refresh requested...');
    const entries = await fetchSheetData();
    const hasChanged = updateDashboard(entries);
    res.json({ 
      success: true, 
      message: 'Dashboard refreshed successfully',
      hasChanged,
      timestamp: new Date().toISOString(),
      entryCount: entries.length
    });
  } catch (error) {
    console.error('Error in manual refresh:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to refresh dashboard data',
      message: error.message 
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
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

// For Vercel, we need to export the app
module.exports = app;
