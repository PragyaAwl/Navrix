const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { validateEntry } = require('./validation');
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

// Function to parse CSV data with better handling of quoted fields and line breaks
function parseCSVData(csvText) {
  const rows = [];
  const lines = csvText.split('\n');
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < csvText.length) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i += 2;
        continue;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      // End of row
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.some(cell => cell && cell.trim() !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      }
      // Skip \r\n combinations
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
    } else {
      currentField += char;
    }
    
    i++;
  }
  
  // Handle last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(cell => cell && cell.trim() !== '')) {
      rows.push(currentRow);
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
  
  // Debug: Show how headers are being converted to keys
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
      
      // Debug: Log entries that are missing scores
      if (!entry.scores || entry.scores === '') {
        console.log(`⚠️  Row ${rowIndex + 2} (${entry.name_of_the_startup || 'No Name'}) missing scores field. Row length: ${row.length}, Expected: ${headers.length}`);
        console.log(`   Raw row data: [${row.slice(0, 5).map(cell => `"${cell}"`).join(', ')}...]`);
      }
      
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
  try {
    // Validate input
    if (!entries || !Array.isArray(entries)) {
      console.warn('Invalid entries data provided to updateDashboard, using empty array');
      entries = [];
    }
    
    // Store previous data for comparison
    const previousData = JSON.parse(JSON.stringify(dashboardData));
    const previousIds = new Set();
    
    // Collect all previous submission IDs
    Object.values(previousData).forEach(category => {
      category.forEach(entry => {
        const id = entry.submission_id || entry.submission__id || entry.name_of_the_startup;
        if (id) previousIds.add(id);
      });
    });
    
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

    // Track current IDs for deletion detection
    const currentIds = new Set();

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
        const id = entry.submission_id || entry.submission__id || entry.name_of_the_startup;
        
        // Debug: Show raw score data for troubleshooting
        console.log(`${index + 1}. ${startupName} | Score: ${scores} | Raw Score Field: "${entry.scores}" | Category: ${category}`);
        
        // If no score, show what fields this entry actually has
        if (!entry.scores || entry.scores === '' || entry.scores === 'No Score') {
          console.log(`   📋 Entry fields for ${startupName}:`, Object.keys(entry).filter(key => entry[key] && entry[key] !== ''));
          // Check for alternative score field names
          const possibleScoreFields = Object.keys(entry).filter(key => 
            key.toLowerCase().includes('score') || 
            key.toLowerCase().includes('rating') ||
            key.toLowerCase().includes('point') ||
            /^\d+$/.test(entry[key]) // Check if any field contains just numbers
          );
          if (possibleScoreFields.length > 0) {
            console.log(`   🔍 Possible score fields found:`, possibleScoreFields.map(field => `${field}: "${entry[field]}"`));
          }
        }
        
        if (id) currentIds.add(id);
        
        newDashboardData[category].push(entry);
      } catch (categorizationError) {
        console.warn(`Error categorizing entry, skipping:`, categorizationError.message);
      }
    });
    
    // Detect deletions
    const deletedIds = [...previousIds].filter(id => !currentIds.has(id));
    const addedIds = [...currentIds].filter(id => !previousIds.has(id));
    
    console.log('\n=== SYNC CHANGES ===');
    if (deletedIds.length > 0) {
      console.log(`🗑️  DELETED entries (${deletedIds.length}):`);
      deletedIds.forEach(id => console.log(`   - ${id}`));
    }
    if (addedIds.length > 0) {
      console.log(`➕ ADDED entries (${addedIds.length}):`);
      addedIds.forEach(id => console.log(`   + ${id}`));
    }
    if (deletedIds.length === 0 && addedIds.length === 0) {
      console.log('No additions or deletions detected');
    }
    console.log('=======================\n');
    
    console.log('\n=== CATEGORY COUNTS ===');
    console.log(`Platinum: ${newDashboardData.platinum.length}`);
    console.log(`Gold: ${newDashboardData.gold.length}`);
    console.log(`Silver: ${newDashboardData.silver.length}`);
    console.log(`Unreviewed: ${newDashboardData.unreviewed.length}`);
    console.log('==========================\n');

    // Check if data has changed
    const hasChanged = JSON.stringify(dashboardData) !== JSON.stringify(newDashboardData);
    
    // Enhanced change detection - show field-level changes
    if (!hasChanged) {
      console.log('📊 Detailed comparison:');
      Object.keys(newDashboardData).forEach(category => {
        const oldEntries = dashboardData[category] || [];
        const newEntries = newDashboardData[category] || [];
        
        newEntries.forEach(newEntry => {
          const oldEntry = oldEntries.find(old => 
            (old.submission_id && old.submission_id === newEntry.submission_id) ||
            (old.name_of_the_startup && old.name_of_the_startup === newEntry.name_of_the_startup)
          );
          
          if (oldEntry) {
            // Check for score changes
            if (oldEntry.scores !== newEntry.scores) {
              console.log(`   🔄 Score change detected for ${newEntry.name_of_the_startup}: ${oldEntry.scores} → ${newEntry.scores}`);
            }
            // Check for other field changes
            Object.keys(newEntry).forEach(field => {
              if (oldEntry[field] !== newEntry[field] && field !== 'scores') {
                console.log(`   📝 Field change detected for ${newEntry.name_of_the_startup}.${field}: "${oldEntry[field]}" → "${newEntry[field]}"`);
              }
            });
          }
        });
      });
    }
    
    if (hasChanged) {
      // Atomic state replacement - replace entire state at once
      // This automatically handles deletions by not including them in the new state
      dashboardData = newDashboardData;
      // Emit update to all connected clients
      io.emit('dashboardUpdate', dashboardData);
      console.log('✅ Dashboard updated and broadcasted to clients');
      console.log('   - Deleted entries are automatically removed from dashboard');
      console.log('   - Only current Google Sheets data is displayed');
    } else {
      console.log('No changes detected in dashboard data');
    }

    return hasChanged;
    
  } catch (error) {
    console.error('Critical error in updateDashboard:', error);
    console.error('Dashboard update failed, maintaining current state');
    return false;
  }
}

// Polling function to check for updates
async function pollForUpdates() {
  try {
    console.log(`🔄 [${new Date().toLocaleTimeString()}] Polling for updates...`);
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