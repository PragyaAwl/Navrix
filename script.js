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

// Store last successful data for fallback
let lastSuccessfulData = null;
let lastSuccessfulTimestamp = null;

// Connection status tracking
let connectionState = {
    isOnline: true,
    lastError: null,
    consecutiveFailures: 0,
    lastSuccessTime: null
};

// Function to update connection status indicator
function updateConnectionStatus(isOnline, errorMessage = null) {
    connectionState.isOnline = isOnline;
    connectionState.lastError = errorMessage;
    
    if (isOnline) {
        connectionStatus.className = 'status-dot online';
        connectionStatus.title = `Online - Last updated: ${new Date().toLocaleTimeString()}`;
        connectionState.consecutiveFailures = 0;
        connectionState.lastSuccessTime = new Date();
    } else {
        connectionStatus.className = 'status-dot offline';
        connectionState.consecutiveFailures++;
        
        let statusMessage = 'Connection failed';
        if (connectionState.consecutiveFailures > 1) {
            statusMessage += ` (${connectionState.consecutiveFailures} attempts)`;
        }
        if (errorMessage) {
            statusMessage += ` - ${errorMessage}`;
        }
        if (connectionState.lastSuccessTime) {
            const timeSinceSuccess = Math.floor((new Date() - connectionState.lastSuccessTime) / 1000);
            statusMessage += ` - Last success: ${timeSinceSuccess}s ago`;
        }
        
        connectionStatus.title = statusMessage;
        console.warn('Connection status updated:', statusMessage);
    }
}

// Function to handle network errors gracefully
function handleNetworkError(error, context = 'data fetch') {
    console.error(`Network error during ${context}:`, error);
    
    let errorMessage = 'Network error';
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = 'Connection failed';
    } else if (error.name === 'AbortError') {
        errorMessage = 'Request timeout';
    } else if (error.message) {
        errorMessage = error.message;
    }
    
    updateConnectionStatus(false, errorMessage);
    
    // Use fallback data if available
    if (lastSuccessfulData && lastSuccessfulData.length > 0) {
        console.log('Using fallback data from last successful fetch');
        console.log(`Fallback data contains ${lastSuccessfulData.length} entries from ${lastSuccessfulTimestamp}`);
        return lastSuccessfulData;
    } else {
        console.warn('No fallback data available, continuing with empty dataset');
        return [];
    }
}
function preserveUIState() {
    const state = {
        currentView: null,
        selectedCategory: null,
        scrollPosition: {
            x: window.scrollX || window.pageXOffset,
            y: window.scrollY || window.pageYOffset
        },
        detailScrollPosition: null
    };
    
    // Determine current view
    if (dashboardView.style.display !== 'none') {
        state.currentView = 'dashboard';
    } else if (categoryDetailView.style.display !== 'none') {
        state.currentView = 'categoryDetail';
        
        // Get selected category from the title
        const titleText = categoryTitle.textContent;
        if (titleText.includes('Platinum')) {
            state.selectedCategory = 'platinum';
        } else if (titleText.includes('Gold')) {
            state.selectedCategory = 'gold';
        } else if (titleText.includes('Silver')) {
            state.selectedCategory = 'silver';
        } else if (titleText.includes('Unreviewed')) {
            state.selectedCategory = 'unreviewed';
        }
        
        // Store detail view scroll position
        state.detailScrollPosition = {
            x: window.scrollX || window.pageXOffset,
            y: window.scrollY || window.pageYOffset
        };
    }
    
    console.log('UI State preserved:', state);
    return state;
}

function restoreUIState(state) {
    if (!state) {
        console.log('No UI state to restore');
        return;
    }
    
    console.log('Restoring UI State:', state);
    
    // Restore the appropriate view
    if (state.currentView === 'dashboard') {
        showDashboard();
        // Restore scroll position for dashboard view
        if (state.scrollPosition) {
            setTimeout(() => {
                window.scrollTo(state.scrollPosition.x, state.scrollPosition.y);
            }, 100); // Small delay to ensure DOM is updated
        }
    } else if (state.currentView === 'categoryDetail' && state.selectedCategory) {
        // Check if the selected category still has valid data
        const entries = currentDashboardData[state.selectedCategory];
        if (entries !== undefined) {
            showCategoryDetail(state.selectedCategory);
            // Restore scroll position for detail view
            if (state.detailScrollPosition) {
                setTimeout(() => {
                    window.scrollTo(state.detailScrollPosition.x, state.detailScrollPosition.y);
                }, 100); // Small delay to ensure DOM is updated
            }
        } else {
            // Category no longer exists, fall back to dashboard
            console.log('Selected category no longer exists, showing dashboard');
            showDashboard();
            if (state.scrollPosition) {
                setTimeout(() => {
                    window.scrollTo(state.scrollPosition.x, state.scrollPosition.y);
                }, 100);
            }
        }
    } else {
        // Default to dashboard view
        showDashboard();
    }
}

// Function to validate entry data before processing
function validateEntry(entry) {
    // Check if entry exists and is an object
    if (!entry || typeof entry !== 'object') {
        return false;
    }
    
    // Get potential identifier fields
    const startupName = entry.name_of_the_startup;
    const submissionId = entry.submission_id || entry.submission__id;
    
    // Check for at least one valid identifier
    const hasValidStartupName = startupName && 
        typeof startupName === 'string' && 
        startupName.trim() !== '' && 
        startupName.trim().toLowerCase() !== 'n/a';
    
    const hasValidSubmissionId = submissionId && 
        typeof submissionId === 'string' && 
        submissionId.trim() !== '' && 
        submissionId.trim().toLowerCase() !== 'n/a';
    
    // Entry is valid if it has at least one valid identifier
    // Handle entries without startup names properly by accepting submission ID as fallback
    if (!hasValidStartupName && !hasValidSubmissionId) {
        return false;
    }
    
    // Additional validation: check if entry has any meaningful data
    // An entry should have more than just empty/null values
    const allFields = Object.values(entry);
    const nonEmptyFields = allFields.filter(value => 
        value !== null && 
        value !== undefined && 
        value !== '' && 
        String(value).trim() !== '' &&
        String(value).trim().toLowerCase() !== 'n/a'
    );
    
    // Entry must have at least 1 non-empty field (just the identifier is sufficient)
    // This allows entries with only submission ID to be valid
    return nonEmptyFields.length >= 1;
}

// Function to verify count accuracy across the dashboard
function verifyCountAccuracy() {
    console.log('\n=== COUNT ACCURACY VERIFICATION ===');
    
    let totalActualEntries = 0;
    let totalDisplayedCount = 0;
    let hasErrors = false;
    
    // Check each category
    Object.keys(countElements).forEach(category => {
        const entries = currentDashboardData[category] || [];
        const actualCount = entries.length;
        const displayedCount = parseInt(countElements[category].textContent) || 0;
        
        totalActualEntries += actualCount;
        totalDisplayedCount += displayedCount;
        
        console.log(`${category.toUpperCase()}: Actual=${actualCount}, Displayed=${displayedCount}`);
        
        if (actualCount !== displayedCount) {
            console.error(`❌ COUNT MISMATCH in ${category}: Expected ${actualCount}, Display shows ${displayedCount}`);
            hasErrors = true;
        }
    });
    
    console.log(`TOTALS: Actual=${totalActualEntries}, Displayed=${totalDisplayedCount}`);
    
    if (totalActualEntries !== totalDisplayedCount) {
        console.error(`❌ TOTAL COUNT MISMATCH: Expected ${totalActualEntries}, Display shows ${totalDisplayedCount}`);
        hasErrors = true;
    }
    
    if (!hasErrors) {
        console.log('✅ All counts are accurate and match actual data');
    }
    
    console.log('===================================\n');
    
    return !hasErrors;
}

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

// Function to fetch data from Google Sheets
async function fetchSheetData() {
    const FETCH_TIMEOUT = 10000; // 10 second timeout
    
    try {
        // Try different CSV export URLs
        const csvUrls = [
            `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=0`,
            `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&gid=0`
        ];
        
        for (const csvUrl of csvUrls) {
            try {
                console.log('Trying CSV URL:', csvUrl);
                
                // Create abort controller for timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
                
                const response = await fetch(csvUrl, {
                    mode: 'cors',
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    const csvText = await response.text();
                    console.log('CSV data received, length:', csvText.length);
                    
                    if (csvText && csvText.trim() !== '') {
                        try {
                            const parsedData = parseCSVData(csvText);
                            
                            // Store successful data for fallback
                            if (parsedData && parsedData.length > 0) {
                                lastSuccessfulData = parsedData;
                                lastSuccessfulTimestamp = new Date().toLocaleString();
                                console.log(`Stored ${parsedData.length} entries as fallback data`);
                            }
                            
                            return parsedData;
                        } catch (parseError) {
                            console.error('Error parsing CSV data:', parseError.message);
                            console.warn('CSV data preview:', csvText.substring(0, 200) + '...');
                            throw new Error(`Data parsing failed: ${parseError.message}`);
                        }
                    } else {
                        throw new Error('Empty CSV response received');
                    }
                } else {
                    console.log(`CSV failed with status: ${response.status} ${response.statusText}`);
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (urlError) {
                console.log('CSV URL error:', urlError.message);
                
                // If this is the last URL and it failed, throw the error
                if (csvUrl === csvUrls[csvUrls.length - 1]) {
                    throw urlError;
                }
            }
        }
        
        throw new Error('All CSV export methods failed');
        
    } catch (error) {
        console.error('Error fetching sheet data:', error);
        
        // Handle different types of errors
        if (error.name === 'AbortError') {
            throw new Error('Request timeout after 10 seconds');
        } else if (error.message.includes('Failed to fetch')) {
            throw new Error('Network connection failed');
        } else {
            throw error;
        }
    }
}

// Function to parse CSV data
function parseCSVData(csvText) {
    try {
        if (!csvText || typeof csvText !== 'string' || csvText.trim() === '') {
            console.warn('Empty or invalid CSV data received');
            return [];
        }
        
        const rows = [];
        const lines = csvText.split('\n');
        
        if (lines.length === 0) {
            console.warn('No lines found in CSV data');
            return [];
        }
        
        for (const line of lines) {
            if (line.trim()) {
                try {
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
                } catch (lineError) {
                    console.warn('Error parsing CSV line, skipping:', line.substring(0, 100) + '...', lineError.message);
                    // Continue processing other lines
                }
            }
        }
        
        if (rows.length === 0) {
            console.warn('No valid rows found after CSV parsing');
            return [];
        }
        
        return processRowData(rows);
        
    } catch (error) {
        console.error('Critical error parsing CSV data:', error);
        console.error('CSV data preview:', csvText.substring(0, 500) + '...');
        
        // Log error without breaking the dashboard
        console.warn('Falling back to empty dataset due to parsing error');
        return [];
    }
}

// Function to process row data into entries
function processRowData(rows) {
    try {
        if (!rows || !Array.isArray(rows) || rows.length === 0) {
            console.warn('No rows to process or invalid row data');
            return [];
        }
        
        if (rows.length < 2) {
            console.warn('CSV data appears to have no data rows (only headers or empty)');
            return [];
        }

        console.log('Headers found:', rows[0]);
        console.log('Total rows:', rows.length);

        const headers = rows[0];
        
        // Validate headers
        if (!headers || !Array.isArray(headers) || headers.length === 0) {
            console.error('Invalid or missing headers in CSV data');
            return [];
        }
        
        const data = [];
        const dataRows = rows.slice(1);
        
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            
            try {
                // Skip completely empty rows
                if (!row || !Array.isArray(row) || !row.some(cell => cell && cell.trim() !== '')) {
                    continue;
                }
                
                const entry = {};
                headers.forEach((header, index) => {
                    try {
                        // Handle malformed headers gracefully
                        const key = header && typeof header === 'string' ? 
                                   header.toLowerCase().replace(/[^a-z0-9]/g, '_') : 
                                   `column_${index}`;
                        
                        // Handle malformed cell data gracefully
                        let cellValue = '';
                        if (row[index] !== undefined && row[index] !== null) {
                            cellValue = String(row[index]).replace(/^"|"$/g, '');
                        }
                        
                        entry[key] = cellValue;
                    } catch (cellError) {
                        console.warn(`Error processing cell at row ${i + 2}, column ${index}:`, cellError.message);
                        // Set a default value and continue
                        entry[`column_${index}`] = '';
                    }
                });
                
                data.push(entry);
                
            } catch (rowError) {
                console.warn(`Error processing row ${i + 2}, skipping:`, rowError.message);
                // Continue processing other rows
            }
        }

        console.log('Successfully processed entries:', data.length);
        
        if (data.length === 0) {
            console.warn('No valid entries found after processing CSV data');
            return [];
        }
        
        console.log('\n=== SUBMISSION IDs FOUND ===');
        data.forEach((entry, index) => {
            try {
                const submissionId = entry.submission_id || entry.submission__id || 'No ID';
                const startupName = entry.name_of_the_startup || 'No Name';
                const scores = entry.scores || 'No Score';
                console.log(`${index + 1}. ID: ${submissionId} | Startup: ${startupName} | Score: ${scores}`);
            } catch (logError) {
                console.warn(`Error logging entry ${index + 1}:`, logError.message);
            }
        });
        console.log('============================\n');
        
        return data;
        
    } catch (error) {
        console.error('Critical error processing row data:', error);
        console.error('Row data preview:', rows ? rows.slice(0, 3) : 'null/undefined');
        
        // Log error without breaking the dashboard
        console.warn('Falling back to empty dataset due to processing error');
        return [];
    }
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
        // This ensures no stale data persists between refresh cycles
        currentDashboardData = {
            platinum: [],
            gold: [],
            silver: [],
            unreviewed: []
        };

        // Create fresh state object for new data
        const newDashboardData = {
            platinum: [],
            gold: [],
            silver: [],
            unreviewed: []
        };

        console.log('\n=== CLEARING EXISTING STATE AND REBUILDING ===');
        console.log('Previous state cleared, processing fresh data...');
        
        // Complete data rebuild logic - process only validated entries
        console.log('\n=== VALIDATING AND CATEGORIZING ENTRIES ===');
        let validEntries = 0;
        let invalidEntries = 0;
        let processingErrors = 0;
        
        // Filter and validate entries first
        const validatedEntries = [];
        
        entries.forEach((entry, index) => {
            try {
                const isValid = validateEntry(entry);
                const startupName = entry.name_of_the_startup || 'No Name';
                const submissionId = entry.submission_id || entry.submission__id || 'No ID';
                const scores = entry.scores || 'No Score';
                
                if (isValid) {
                    console.log(`${index + 1}. ✓ VALID - ${startupName} (ID: ${submissionId}) | Score: ${scores}`);
                    validEntries++;
                    validatedEntries.push(entry);
                } else {
                    console.log(`${index + 1}. ✗ INVALID - ${startupName} (ID: ${submissionId}) | Score: ${scores} | SKIPPED`);
                    invalidEntries++;
                }
            } catch (entryError) {
                console.warn(`Error processing entry ${index + 1}, skipping:`, entryError.message);
                processingErrors++;
            }
        });
        
        console.log(`\nValidation Summary: ${validEntries} valid, ${invalidEntries} invalid, ${processingErrors} processing errors`);
        
        // Rebuild categories from scratch with only validated entries
        console.log('\n=== REBUILDING CATEGORIES FROM SCRATCH ===');
        validatedEntries.forEach((entry) => {
            try {
                const category = categorizeEntry(entry);
                
                // Skip entries that couldn't be categorized (returned null)
                if (category === null) {
                    console.warn(`Skipping entry that failed categorization: ${entry.name_of_the_startup || entry.submission_id}`);
                    return;
                }
                
                const startupName = entry.name_of_the_startup || 'No Name';
                console.log(`Adding ${startupName} to ${category} category`);
                newDashboardData[category].push(entry);
            } catch (categorizationError) {
                console.warn(`Error categorizing entry, skipping:`, categorizationError.message);
            }
        });
        
        console.log('\n=== FINAL CATEGORY COUNTS ===');
        console.log(`Platinum: ${newDashboardData.platinum.length}`);
        console.log(`Gold: ${newDashboardData.gold.length}`);
        console.log(`Silver: ${newDashboardData.silver.length}`);
        console.log(`Unreviewed: ${newDashboardData.unreviewed.length}`);
        console.log('Total entries processed:', validEntries);
        
        // Verify count accuracy - ensure counts match actual entry arrays
        const actualTotalEntries = newDashboardData.platinum.length + 
                                  newDashboardData.gold.length + 
                                  newDashboardData.silver.length + 
                                  newDashboardData.unreviewed.length;
        
        console.log('Actual total in categories:', actualTotalEntries);
        
        if (actualTotalEntries !== validEntries) {
            console.error(`COUNT MISMATCH: Expected ${validEntries} entries, but categories contain ${actualTotalEntries}`);
        } else {
            console.log('✓ Count verification passed - all entries properly categorized');
        }
        console.log('==========================\n');

        // Atomic state replacement - replace entire state at once
        currentDashboardData = newDashboardData;

        // Update count display after each refresh - ensure counts match actual entry arrays
        console.log('\n=== UPDATING UI COUNTS ===');
        Object.keys(countElements).forEach(category => {
            try {
                const countElement = countElements[category];
                const entries = newDashboardData[category] || [];
                const actualCount = entries.length;
                
                // Update the display
                countElement.textContent = actualCount;
                
                // Log the update for verification
                console.log(`${category.toUpperCase()} count updated: ${actualCount}`);
                
                // Double-check that the displayed count matches the actual array length
                if (parseInt(countElement.textContent) !== actualCount) {
                    console.error(`UI COUNT ERROR: ${category} display shows ${countElement.textContent} but array has ${actualCount} entries`);
                }
            } catch (uiError) {
                console.error(`Error updating UI count for ${category}:`, uiError.message);
            }
        });
        
        // Final verification - ensure UI counts sum to total entries
        const displayedTotal = Object.keys(countElements).reduce((sum, category) => {
            try {
                return sum + parseInt(countElements[category].textContent);
            } catch (sumError) {
                console.warn(`Error reading count for ${category}:`, sumError.message);
                return sum;
            }
        }, 0);
        
        console.log(`Total displayed count: ${displayedTotal}`);
        console.log(`Actual total entries: ${actualTotalEntries}`);
        
        if (displayedTotal !== actualTotalEntries) {
            console.error(`UI TOTAL MISMATCH: Displayed total ${displayedTotal} does not match actual total ${actualTotalEntries}`);
        } else {
            console.log('✓ UI count verification passed - displayed counts match actual data');
        }
        console.log('========================\n');

        // Final count accuracy verification
        verifyCountAccuracy();

        return true;
        
    } catch (error) {
        console.error('Critical error in updateDashboard:', error);
        console.error('Dashboard update failed, maintaining current state');
        
        // Don't throw the error - log it and continue with current state
        // This prevents the entire dashboard from breaking due to data processing errors
        return false;
    }
}

// Function to load and update dashboard
async function loadDashboard() {
    try {
        // Preserve state before data refresh
        const preservedState = preserveUIState();
        
        console.log('Starting dashboard refresh...');
        const entries = await fetchSheetData();
        
        // Update connection status to online on successful fetch
        updateConnectionStatus(true);
        
        updateDashboard(entries);
        
        // Restore state after successful update
        restoreUIState(preservedState);
        
        console.log('Dashboard updated successfully');
    } catch (error) {
        console.error('Error loading dashboard:', error);
        
        // Handle network error and get fallback data
        const fallbackEntries = handleNetworkError(error, 'dashboard refresh');
        
        // If we have fallback data, use it
        if (fallbackEntries.length > 0) {
            console.log('Updating dashboard with fallback data');
            updateDashboard(fallbackEntries);
            
            // Restore state even with fallback data
            const preservedState = preserveUIState();
            restoreUIState(preservedState);
        } else {
            console.warn('No data available (current or fallback), dashboard may show empty state');
        }
        
        // Note: We don't restore state on error to avoid potential issues
        // The UI will remain in its current state if data fetch fails completely
    }
}

// Function to create entry card HTML
function createEntryCard(entry) {
    // Helper function to check if a field has valid data
    function hasValidData(value) {
        return value && 
               typeof value === 'string' && 
               value.trim() !== '' && 
               value.trim().toLowerCase() !== 'n/a';
    }
    
    // Helper function to render field only if it has valid data
    function renderField(label, value, isLink = false) {
        if (!hasValidData(value)) {
            return ''; // Skip rendering fields with no valid data
        }
        
        if (isLink) {
            return `
                <div class="entry-detail">
                    <strong>${label}:</strong>
                    <a href="${value}" target="_blank" class="drive-link">View Document</a>
                </div>
            `;
        }
        
        return `
            <div class="entry-detail">
                <strong>${label}:</strong>
                <span>${value}</span>
            </div>
        `;
    }
    
    // Get entry title - use startup name or submission ID as fallback
    const startupName = entry.name_of_the_startup;
    const submissionId = entry.submission_id || entry.submission__id;
    const entryTitle = hasValidData(startupName) ? startupName : 
                      hasValidData(submissionId) ? `Submission ${submissionId}` : 
                      'Entry';
    
    // Handle score display
    const score = parseFloat(entry.scores);
    const hasValidScore = !isNaN(score) && isFinite(score) && score > 0;
    
    // Build the card HTML with only valid fields
    let cardHTML = `
        <div class="entry-card">
            <div class="entry-title">${entryTitle}</div>
            <div class="entry-details">
    `;
    
    // Add fields only if they have valid data
    cardHTML += renderField('Founder', entry.founder_s__name);
    cardHTML += renderField('Email', entry.what_is_your_email_address_);
    
    // Add score only if it's valid
    if (hasValidScore) {
        cardHTML += `
            <div class="entry-detail">
                <strong>Score:</strong>
                <span class="score">${score}</span>
            </div>
        `;
    }
    
    // Add drive link only if valid
    cardHTML += renderField('Drive', entry.drive_link, true);
    
    // Add submitted date only if valid
    const formattedDate = formatDate(entry.submitted_at);
    if (formattedDate) { // formatDate now returns null for invalid dates
        cardHTML += `
            <div class="entry-detail">
                <strong>Submitted:</strong>
                <span>${formattedDate}</span>
            </div>
        `;
    }
    
    cardHTML += `
            </div>
        </div>
    `;
    
    return cardHTML;
}

// Function to format date
function formatDate(dateString) {
    // Handle missing data gracefully - return null instead of 'N/A'
    if (!dateString || 
        typeof dateString !== 'string' || 
        dateString.trim() === '' || 
        dateString.trim().toLowerCase() === 'n/a') {
        return null; // Return null so createEntryCard can skip rendering this field
    }
    
    try {
        const date = new Date(dateString);
        // Check if the date is valid
        if (isNaN(date.getTime())) {
            return null; // Invalid date, skip rendering
        }
        
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        // If formatting fails, return the original string only if it's meaningful
        return dateString.trim() !== '' ? dateString : null;
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