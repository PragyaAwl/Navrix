# Startup Dashboard

A real-time dashboard that syncs with Google Sheets to categorize startup submissions based on scores.

## 🚀 Live Demo

**GitHub Pages**: [https://pragyaawl.github.io/Navrix/](https://pragyaawl.github.io/Navrix/)

## ✨ Features

- **Real-time Updates**: Automatically reflects changes from Google Sheets
- **Smart Categorization**: 
  - 🥇 Platinum (85-100 score)
  - 🥈 Gold (70-84 score) 
  - 🥉 Silver (0-69 score)
  - 📋 Unreviewed (no score/empty)
- **Interactive Dashboard**: Click categories to drill down into entries
- **Responsive Design**: Works on desktop and mobile
- **Static Site**: Runs entirely in the browser, no server required

## 🛠️ Setup Instructions

### 1. Clone Repository
```bash
git clone https://github.com/PragyaAwl/Navrix.git
cd Navrix
```

### 2. Configure Google Sheet ID
Edit `script.js` and replace the Google Sheet ID:
```javascript
const GOOGLE_SHEET_ID = 'your_sheet_id_here';
```

### 3. Google Sheet Setup

**Make your Google Sheet public:**
1. Open your Google Sheet
2. Click "Share" button (top-right)
3. Click "Change to anyone with the link"
4. Set permission to "Viewer"
5. Click "Done"

**Required columns:**
- Submission ID
- Respondent ID  
- Submitted at
- Name of the startup
- Founder(s) Name
- What is your email address?
- What is your phone number?
- Tell us a bit about what you are building
- Are you looking to raise funds?
- Current Stage?
- Pitch Deck / White Paper Upload (.pdf preferred)
- Anything you would want us to know?
- Untitled checkboxes field (x2)
- Drive Link
- Scores

### 4. Run Locally

Simply open `index.html` in your browser, or use a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8000
```

Visit `http://localhost:8000` to view the dashboard.

## 🚀 Deploy to GitHub Pages

### Enable GitHub Pages:
1. Go to your repository settings
2. Scroll to "Pages" section
3. Select "Deploy from a branch"
4. Choose "main" branch
5. Select "/ (root)" folder
6. Click "Save"

Your dashboard will be live at: `https://yourusername.github.io/repositoryname/`

## 📊 How It Works

1. **Data Fetching**: Fetches data directly from public Google Sheets via CSV export
2. **Client-Side Processing**: All data processing happens in the browser
3. **Categorization**: Entries are automatically categorized based on scores
4. **Real-time Updates**: Polls Google Sheets every 30 seconds for changes
5. **Smart Detection**: New entries without scores go to "Unreviewed"
6. **Dynamic Movement**: Entries move between categories when scores are updated

## 🎯 Usage

1. **Main Dashboard**: View all 4 categories with entry counts
2. **Click Categories**: Drill down to see detailed entries
3. **Back Navigation**: Return to main dashboard easily
4. **Auto-Updates**: Data refreshes automatically every 30 seconds

## 🎨 Customization

- **Sheet ID**: Update `GOOGLE_SHEET_ID` in `script.js`
- **Score Thresholds**: Modify `categorizeEntry()` function in `script.js`
- **Update Interval**: Change the interval in the `setInterval()` call
- **Styling**: Customize appearance in `styles.css`
- **Entry Fields**: Update `createEntryCard()` function for different data fields

## 🐛 Troubleshooting

1. **No data showing**: 
   - Check Google Sheets permissions (must be public)
   - Verify the Sheet ID in `script.js`
   - Check browser console for errors

2. **CORS errors**: 
   - Ensure sheet is publicly accessible
   - Try different browsers
   - Use a local server instead of opening HTML directly

3. **Not updating**: 
   - Verify sheet is accessible via CSV export URL
   - Check network tab in browser dev tools

## 📁 File Structure

```
├── index.html          # Main HTML file
├── styles.css          # Styling
├── script.js           # JavaScript logic
├── README.md           # Documentation
└── .gitignore         # Git ignore rules
```

## 🌐 Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Responsive design
