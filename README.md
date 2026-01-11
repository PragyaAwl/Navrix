# Startup Dashboard

A real-time dashboard that syncs with Google Sheets to categorize startup submissions based on scores.

## 🚀 Live Demo

Deploy this to Vercel: [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/PragyaAwl/Navrix)

## ✨ Features

- **Real-time Updates**: Automatically reflects changes from Google Sheets
- **Smart Categorization**: 
  - 🥇 Platinum (85-100 score)
  - 🥈 Gold (70-84 score) 
  - 🥉 Silver (0-69 score)
  - 📋 Unreviewed (no score/empty)
- **Interactive Dashboard**: Click categories to drill down into entries
- **Responsive Design**: Works on desktop and mobile

## 🛠️ Setup Instructions

### 1. Clone Repository
```bash
git clone https://github.com/PragyaAwl/Navrix.git
cd Navrix
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration

1. Copy `.env.example` to `.env`
2. Add your Google Sheet ID:
```
GOOGLE_SHEET_ID=your_sheet_id_here
PORT=3000
```

### 4. Google Sheet Setup

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

### 5. Run Locally

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Visit `http://localhost:3000` to view the dashboard.

## 🚀 Deploy to Vercel

### Option 1: One-Click Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/PragyaAwl/Navrix)

### Option 2: Manual Deploy
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variable
vercel env add GOOGLE_SHEET_ID

# Redeploy with env vars
vercel --prod
```

## 📊 How It Works

1. **Data Fetching**: Fetches data from public Google Sheets via CSV export
2. **Categorization**: Entries are automatically categorized based on scores
3. **Real-time Updates**: Polls Google Sheets every 30 seconds for changes
4. **Smart Detection**: New entries without scores go to "Unreviewed"
5. **Dynamic Movement**: Entries move between categories when scores are updated

## 🎯 Usage

1. **Main Dashboard**: View all 4 categories with entry counts
2. **Click Categories**: Drill down to see detailed entries
3. **Back Navigation**: Return to main dashboard easily
4. **Auto-Updates**: Data refreshes automatically

## 🔧 API Endpoints

- `GET /api/dashboard` - Get current dashboard data
- `GET /api/health` - Health check

## 🎨 Customization

- Modify score thresholds in `api/server.js` (categorizeEntry function)
- Update polling interval (currently 30 seconds for serverless)
- Customize UI styling in `public/styles.css`
- Add additional fields by updating the entry card template

## 🐛 Troubleshooting

1. **No data showing**: Check Google Sheets permissions (must be public)
2. **Not updating**: Verify sheet is accessible via CSV export URL
3. **Deployment issues**: Ensure environment variables are set in Vercel

## 📝 License

MIT License - feel free to use this for your projects!

---

Built with ❤️ for startup communities