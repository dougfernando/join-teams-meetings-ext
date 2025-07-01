<#
.SYNOPSIS
    Retrieves today's Microsoft Teams meetings from the Outlook calendar and exports them to a CSV file.

.PARAMETER OutputPath
    Specifies the full path for the output CSV file.
    If not provided, it defaults to "C:\Users\<YourUsername>\todays_meetings.csv".

.EXAMPLE
    .\Get-TodayTeamsMeetings.ps1
    (Exports the meeting list to the default path in your user profile)

.EXAMPLE
    .\Get-TodayTeamsMeetings.ps1 -OutputPath "C:\Temp\MyMeetings.csv"
    (Exports the meeting list to the specified path)
#>
param(
    [Parameter(Mandatory=$false)]
    [string]$OutputPath = "$env:USERPROFILE\todays_meetings.csv"
)

# --- Main Script ---
try {
    # --- Outlook COM Object Setup ---
    $outlook = New-Object -ComObject Outlook.Application
    $namespace = $outlook.GetNamespace("MAPI")
    $calendar = $namespace.GetDefaultFolder(9) # 9 = olFolderCalendar
    $allAppointments = $calendar.Items
    $allAppointments.IncludeRecurrences = $true
    $allAppointments.Sort("[Start]")

    # --- Filtering Logic (from user-provided working script) ---
    # Use ToShortDateString() as it correctly uses the local system's date format.
    $startTime = (Get-Date).ToShortDateString()
    $endTime = (Get-Date).AddDays(1).ToShortDateString()
    
    # This filter performs an initial, broad search.
    $filter = "[Start] < '$endTime' AND [End] >= '$startTime'"
    $restrictedAppointments = $allAppointments.Restrict($filter)

    # This array will hold the final list of meetings that occur today.
    $todaysMeetings = @()

    # Loop through the filtered items to correctly identify today's recurring instances.
    foreach ($appointment in $restrictedAppointments) {
        if (-Not $appointment.IsRecurring) {
            # If it's not a recurring meeting, it's definitely today, so add it.
            $todaysMeetings += $appointment
        }
        else {
            # For recurring meetings, we must verify there is an actual occurrence today.
            try {
                # GetOccurrence will throw an error if no instance exists on the specified date.
                # We create a full DateTime object for the check.
                $occurrenceCheckDate = (Get-Date).Date + $appointment.Start.TimeOfDay
                $occurrence = $appointment.GetRecurrencePattern().GetOccurrence($occurrenceCheckDate)
                # If GetOccurrence did not throw an error, an instance exists today.
                if ($occurrence) {
                    $todaysMeetings += $appointment
                }
            }
            catch {
                # An error indicates no occurrence for this specific recurring meeting today.
                # We can safely ignore this error and continue to the next item.
            }
        }
    }

    # (The remainder of your script to process and export $todaysMeetings to the $OutputPath would follow here)
    # For example:
    # $todaysMeetings | Select-Object -Property Subject, Start, End | Export-Csv -Path $OutputPath -NoTypeInformation
    Write-Host "Script finished. Check the output file at: $OutputPath"

}
catch {
    Write-Error "An error occurred: $($_.Exception.Message)"
}
