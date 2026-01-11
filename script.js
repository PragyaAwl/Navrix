// Configuration - Replace with your Google Sheet ID
const GOOGLE_SHEET_ID = '1rEepHIVBCdwsBgpCB7b0B0oNPJsyX00EpyoJx7Zob80';

// DOM elements
const connectionStatus = document.getElementById('connectionStatus');
const dashboardView = document.getElementById('dashboardView');
const categoryDetailView = document.getElementById('categoryDetailView');
const backButton = document.getElementById('backButton');
const categoryTitle = document.getElementById('categoryTitle');
const detailCount = document.getElementById('detailCount');
const detailEntries = document.getElementById('detailEntries');

const countElements = {
    platinum: document.getElementById('platinumCount'),
    gold: document.getElementById('goldCount'),
    silver: document.getElementById('silverCount'),
    unreviewed: document.getElementById('unreviewedCount')
};

// Store current dashboard data
let currentDashboardData = {};

// Function to categorize entries based on score
function categorizeEntry(entry) {
    const score = parseFloat(entry.scores) || 0;
    
    if (score >= 85) return 'platinum';
    if (score >= 70) return 'gold';
    if (score > 0) return 'silver';
    return 'unreviewed';
}

// Function to fetch data from Google Sheets
async function fetchSheetData() {
    try {
        // Try different CSV export URLs
        const csvUrls = [
            `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=0`,
            `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&gid=0`
        ];
        
        for (const csvUrl of csvUrls) {
            try {
                console.log('Trying CSV URL:', csvUrl);
                
                const response = await fetch(csvUrl, {
                    mode: 'cors'
                });
                
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
        
        console.error('All CSV export methods failed');
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

    // Store the data for category detail views
    currentDashboardData = newDashboardData;

    // Update counts
    Object.keys(countElements).forEach(category => {
        const countElement = countElements[category];
        const entries = newDashboardData[category] || [];
        countElement.textContent = entries.length;
    });

    return true;
}

// Function to load and update dashboard
async function loadDashboard() {
    try {
        connectionStatus.className = 'status-dot online';
        const entries = await fetchSheetData();
        updateDashboard(entries);
        console.log('Dashboard updated successfully');
    } catch (error) {
        console.error('Error loading dashboard:', error);
        connectionStatus.className = 'status-dot offline';
    }
}

// Function to create entry card HTML
function createEntryCard(entry) {
    const score = parseFloat(entry.scores) || 0;
    const hasScore = score > 0;
    const hasDriveLink = entry.drive_link && entry.drive_link.trim() !== '';
    
    return `
        <div class="entry-card">
            <div class="entry-title">${entry.name_of_the_startup || 'Unnamed Startup'}</div>
            <div class="entry-details">
                <div class="entry-detail">
                    <strong>Founder:</strong>
                    <span>${entry.founder_s__name || 'N/A'}</span>
                </div>
                <div class="entry-detail">
                    <strong>Email:</strong>
                    <span>${entry.what_is_your_email_address_ || 'N/A'}</span>
                </div>
                <div class="entry-detail">
                    <strong>Stage:</strong>
                    <span>${entry.current_stage_ || 'N/A'}</span>
                </div>
                ${hasScore ? `
                <div class="entry-detail">
                    <strong>Score:</strong>
                    <span class="score">${score}</span>
                </div>
                ` : ''}
                ${hasDriveLink ? `
                <div class="entry-detail">
                    <strong>Drive:</strong>
                    <a href="${entry.drive_link}" target="_blank" class="drive-link">View Document</a>
                </div>
                ` : ''}
                <div class="entry-detail">
                    <strong>Submitted:</strong>
                    <span>${formatDate(entry.submitted_at) || 'N/A'}</span>
                </div>
            </div>
        </div>
    `;
}

// Function to format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return dateString;
    }
}

// Function to show category detail view
function showCategoryDetail(category) {
    const entries = currentDashboardData[category] || [];
    const categoryNames = {
        platinum: 'Platinum (85-100)',
        gold: 'Gold (70-84)',
        silver: 'Silver (0-69)',
        unreviewed: 'Unreviewed'
    };

    // Update header
    categoryTitle.textContent = categoryNames[category];
    detailCount.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;

    // Clear and populate entries
    detailEntries.innerHTML = '';
    
    if (entries.length === 0) {
        detailEntries.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 40px; grid-column: 1/-1;">No entries in this category</div>';
    } else {
        entries.forEach(entry => {
            detailEntries.innerHTML += createEntryCard(entry);
        });
    }

    // Show detail view, hide dashboard
    dashboardView.style.display = 'none';
    categoryDetailView.style.display = 'block';

    // Add animation to new entries
    setTimeout(() => {
        const newCards = detailEntries.querySelectorAll('.entry-card');
        newCards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
        });
    }, 50);
}

// Function to show dashboard view
function showDashboard() {
    dashboardView.style.display = 'grid';
    categoryDetailView.style.display = 'none';
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    // Add click handlers to category boxes
    document.querySelectorAll('.category-box.clickable').forEach(box => {
        box.addEventListener('click', (e) => {
            const category = e.currentTarget.dataset.category;
            showCategoryDetail(category);
        });
    });

    // Back button handler
    backButton.addEventListener('click', () => {
        showDashboard();
    });

    console.log('Dashboard initialized');
    
    // Initial load
    loadDashboard();
    
    // Auto-refresh every 30 seconds
    setInterval(loadDashboard, 30000);
});