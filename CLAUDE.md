# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Raycast extension for Windows that allows users to join Microsoft Teams meetings. The extension reads upcoming Teams meetings (next 5 days) from a CSV file and provides a quick way to join them through Raycast's interface.

## Key Features

- **Visual Status Indicators**: Meetings display with intuitive icons based on status:
  - 🎥 Active (Icon.Video): Currently ongoing or starting within 5 minutes - displays "Active" label
  - 📅 Upcoming (Icon.Calendar): Scheduled for later - displays "Upcoming" label
  - ✅ Ended (Icon.CheckCircle): Past meetings - displays "Done" label
- **Auto-Refresh**: Automatically refreshes meetings file if older than configured hours
- **PowerShell Integration**: Includes bundled script to extract meetings from Outlook
- **Date Grouping**: Groups meetings by date with "Today", "Tomorrow", and date sections
- **Filter Dropdown**: "All Meetings" or "Upcoming & Active" to hide ended meetings
- **Keyboard Shortcuts**: Ctrl+J (join), Ctrl+C (copy), Ctrl+R (reload), Ctrl+Shift+R (refresh with PowerShell)

## Key Architecture Components

- **Raycast Extension**: Built with TypeScript/React using Raycast API
- **Data Source**: CSV file with semicolon delimiters (`StartTime;Subject;TeamsLink`)
- **Teams Integration**: Converts https URLs to msteams:// protocol for desktop app launching
- **PowerShell Automation**: Bundled script (`extract_teams_meetings.ps1`) extracts meetings from Outlook for next 5 days

## Development Commands

```bash
# Install dependencies
npm ci

# Development mode (adds extension to Raycast)
npm run dev

# Build extension
npm run build

# Lint code
npm run lint

# Auto-fix lint issues
npm run fix-lint

# Publish extension
npm publish
```

## Core Files

- `src/find-meetings.tsx`: Main React component that displays meetings list and handles Teams link launching
- `package.json`: Raycast extension manifest with commands, preferences, and dependencies

## Meeting Data Format

The extension expects a CSV file with semicolon delimiters containing:
- `StartTime`: Meeting start time
- `Subject`: Meeting title/subject
- `TeamsLink`: Teams meeting URL

## Key Technical Details

- **Teams URL Handling**: Converts `https://teams.microsoft.com/l/meetup-join/...` to `msteams://` protocol
- **Windows Integration**: Uses Windows `start` command to launch Teams desktop app
- **CSV Parsing**: Manual parsing with semicolon delimiter (not standard comma)
- **Error Handling**: Comprehensive error handling for file I/O and Teams launching

## Preferences

The extension has four configurable preferences:
- `meetingsFilePath`: Path to the CSV file containing meeting data (default: `~/meetings.csv`)
- `powershellScriptPath`: Path to a custom PowerShell script (optional, uses bundled script if empty)
- `powershellFunctionName`: Name of the PowerShell function to call (optional, defaults to 'extract-meetings')
- `autoRefreshHours`: Automatically refresh meetings file if older than this many hours (default: 24, set to 0 to disable)

## Platform Requirements

- Windows only (uses Windows start command)
- Microsoft Teams desktop app recommended for best experience

## Claude Code Integration

This project is optimized for use with Claude Code (claude.ai/code). Key considerations:

### Development Workflow
- Use `npm run lint` and `npm run fix-lint` for code quality checks
- Run `npm run dev` to test changes in Raycast during development
- Build with `npm run build` before publishing

### Code Style
- Follow existing TypeScript/React patterns in the codebase
- Use Raycast API conventions for extension development
- Maintain semicolon-delimited CSV parsing format for data consistency

### File Structure
- Main logic in `src/find-meetings.tsx`
- Extension configuration in `package.json`
- PowerShell script in `assets/extract_teams_meetings.ps1`
- Claude-specific files in `.claude/` directory (ignored by git)

## Original Repository

This extension is based on: **https://github.com/dougfernando/join-teams-meetings-ext**

Referenced projects:
- https://github.com/PuttTim/windows-terminal
- https://github.com/dougfernando/everything-raycast-extension