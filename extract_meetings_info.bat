@echo off
REM This batch file executes the PowerShell script to get today's Teams meetings.
REM It assumes the PowerShell script "Get-TodayTeamsMeetings.ps1" is in the same directory.
REM If the script is located elsewhere, provide the full path to the -File argument.

REM Get the directory where this batch file is located.
SET "SCRIPT_DIR=%~dp0"

REM Define the full path to the PowerShell script.
SET "POWERSHELL_SCRIPT=%SCRIPT_DIR%extract_teams_meetings.ps1"

REM Define the output path using the %USERPROFILE% variable, which is the equivalent of ~.
SET "OUTPUT_FILE=%USERPROFILE%\todays_meetings.csv"

REM Execute the PowerShell script, bypassing the execution policy for this run only.
powershell.exe -ExecutionPolicy Bypass -File "%POWERSHELL_SCRIPT%" -OutputPath "%OUTPUT_FILE%"
