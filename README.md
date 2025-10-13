# Join Teams Meetings - Raycast Extension for Windows

A powerful Raycast extension for Windows that simplifies joining Microsoft Teams meetings. Browse today's meetings with visual status indicators and join them instantly through the Teams desktop app.

## ✨ Main Features

### 🎯 Quick Meeting Access
- Browse today's Teams meetings in a clean, organized interface
- One-click joining through Teams desktop app
- Date grouping for multi-day meeting views
- Copy meeting links to clipboard

### 📊 Visual Status Indicators
- **Active meetings** (🔴): Currently ongoing or starting within 5 minutes
- **Upcoming meetings** (⚪): Scheduled for later today
- **Ended meetings** (✅): Past meetings for reference

### 🔄 PowerShell Integration
- Automated meeting refresh using custom PowerShell scripts
- Configurable script path and function name
- Extract meetings directly from Outlook or other sources
- Seamless CSV generation and updates

### ⌨️ Keyboard Shortcuts
- `Ctrl+J`: Join Teams meeting
- `Ctrl+C`: Copy meeting link to clipboard
- `Ctrl+R`: Refresh meetings from CSV file
- `Ctrl+Shift+R`: Refresh using PowerShell script (if configured)

### 📁 Flexible Data Sources
- CSV file support with semicolon delimiters
- Configurable file path (default: `~/meetings.csv`)
- Compatible with automated meeting extraction scripts

## 🚀 Installation

### Prerequisites
- Node.js (install via: `winget install -e --id OpenJS.NodeJS`)
- Microsoft Teams desktop app
- Raycast for Windows

### Setup Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/dougfernando/join-teams-meetings-ext.git
   cd join-teams-meetings-ext
   ```

2. Install dependencies:
   ```bash
   npm ci
   ```

3. Add to Raycast:
   ```bash
   npm run dev
   ```

## 📋 CSV Format

The extension expects a CSV file with semicolon delimiters:
```
StartTime;Subject;TeamsLink
09:00;Daily Standup;https://teams.microsoft.com/l/meetup-join/...
14:00;Project Review;https://teams.microsoft.com/l/meetup-join/...
```

### Extracting Meetings from Outlook

The repository includes a PowerShell script (`extract_teams_meetings.ps1`) that can automatically extract Teams meetings from the Outlook classic desktop app:

```powershell
# Run the script to extract meetings
. .\extract_teams_meetings.ps1
extract-meetings
```

This script will:
- Connect to your Outlook calendar
- Extract all Teams meetings for the next 5 days
- Generate a CSV file at `~/upcoming_meetings.csv`
- Include meeting start times, subjects, and Teams join links

**Requirements:**
- Microsoft Outlook desktop app (classic version)
- PowerShell execution policy allowing script execution

## ⚙️ Configuration

Configure the extension through Raycast preferences:

- **Meetings File Path**: Path to your CSV file (default: `~/meetings.csv`)
- **PowerShell Script Path**: Path to your meeting extraction script (optional)
- **PowerShell Function Name**: Function to call for meeting refresh (optional)

## 🛠️ Development

```bash
# Development mode
npm run dev

# Build extension
npm run build

# Lint code
npm run lint

# Fix lint issues
npm run fix-lint
```

## 📜 Based On
- https://github.com/PuttTim/windows-terminal
- https://github.com/dougfernando/everything-raycast-extension