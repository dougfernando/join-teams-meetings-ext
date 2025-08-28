# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Raycast extension for Windows that allows users to join Microsoft Teams meetings. The extension reads today's Teams meetings from a CSV file and provides a quick way to join them through Raycast's interface.

## Key Architecture Components

- **Raycast Extension**: Built with TypeScript/React using Raycast API
- **Data Source**: CSV file with semicolon delimiters (`StartTime;Subject;TeamsLink`)
- **Teams Integration**: Converts https URLs to msteams:// protocol for desktop app launching

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

The extension has one configurable preference:
- `meetingsFilePath`: Path to the CSV file containing meeting data (default: `~/todays_meetings.csv`)

## Platform Requirements

- Windows only (uses Windows start command)
- Microsoft Teams desktop app recommended for best experience