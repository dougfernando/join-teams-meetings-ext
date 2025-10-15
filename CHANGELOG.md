# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Improved visual status indicators with more intuitive icons:
  - Active meetings now use Video icon instead of filled circle
  - Upcoming meetings now use Calendar icon instead of clock
  - Ended meetings now use CheckCircle icon instead of progress circle
- Changed status accessories from duplicate icons to text labels ("Active", "Upcoming", "Done")
- Enhanced visual clarity by removing icon duplication in the UI

## [Previous Updates]

### Added
- Filter functionality to hide past meetings via dropdown in main list
- "Upcoming & Active" filter option to show only non-ended meetings
- Better empty state messaging when all meetings are filtered out
- Keyboard shortcuts for all actions
  - Ctrl+J (join), Ctrl+C (copy), Ctrl+R (reload), Ctrl+Shift+R (PowerShell refresh)

### Changed
- Moved filter from preferences to main UI dropdown for better UX
- Updated extension scope to handle any meetings (not just today's)
- Renamed command from "Find Today's Teams Meetings" to "Find Teams Meetings"
- Changed default CSV filename from "todays_meetings.csv" to "meetings.csv"
- Updated PowerShell function name from "Get-TodayTeamsMeetings" to "Get-TeamsMeetings"
- Improved meeting status detection and display

### Fixed
- Fixed icon path for Raycast store compliance
- Corrected package.json metadata for store submission

## [1.0.0] - Initial Release

### Added
- Basic Teams meetings listing from CSV file
- Meeting status indicators (upcoming, active, ended)
- Date grouping functionality
- PowerShell integration for meeting refresh
- Copy meeting link functionality
- Teams meeting launching via msteams:// protocol
- Windows-specific implementation