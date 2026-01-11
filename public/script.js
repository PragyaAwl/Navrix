// Initialize connection
let socket;
let dashboardData = {};

// Function to connect to API
async function connectToAPI() {
    try {
        // For Vercel deployment, use relative API path
        const response = await fetch('/api/dashboard');
        if (response.ok) {
            const data = await response.json();
            updateDashboard(data);
            console.log('Dashboard data loaded from API');
        } else {
            console.error('Failed to load dashboard data');
        }
    } catch (error) {
        console.error('Error connecting to API:', error);
    }
}

// Polling function for updates
async function pollForUpdates() {
    await connectToAPI();
}

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

// Category click handlers
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

    // Initial load
    console.log('Dashboard initialized');
    connectToAPI();
    
    // Poll for updates every 30 seconds (less frequent for serverless)
    setInterval(pollForUpdates, 30000);
    
    // Set connection status
    connectionStatus.className = 'status-dot online';
});

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

// Socket event handlers
socket.on('connect', () => {
    console.log('Connected to server');
    connectionStatus.className = 'status-dot online';
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    connectionStatus.className = 'status-dot offline';
});

socket.on('dashboardUpdate', (data) => {
    console.log('Dashboard update received:', data);
    updateDashboard(data);
});

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

// Function to update dashboard with new data
function updateDashboard(data) {
    // Store the data for category detail views
    currentDashboardData = data;

    // Update counts only
    Object.keys(countElements).forEach(category => {
        const countElement = countElements[category];
        const entries = data[category] || [];
        countElement.textContent = entries.length;
    });
}

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard initialized');
});