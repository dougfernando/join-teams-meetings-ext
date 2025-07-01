[CmdletBinding()]
param (
    # Defines the full path where the CSV file will be saved.
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
                # If it doesn't throw an error, an occurrence exists today. Add it.
                # Note: We add the specific occurrence, not the master recurring appointment.
                if ($occurrence) {
                    $todaysMeetings += $occurrence
                }
            }
            catch {
                # This meeting is a recurring series, but no instance falls on today. Ignore it.
            }
        }
    }

    # --- Process and Export Today's Meetings ---
    $meetingsOutput = @()
    $teamsUrlRegex = 'https://teams.microsoft.com/l/meetup-join/[^"'' >]+'

    # Now, loop through the clean list of today's meetings and find the Teams links.
    foreach ($meeting in $todaysMeetings) {
        if ($meeting.Body -match $teamsUrlRegex) {
            $meetingsOutput += [PSCustomObject]@{
                StartTime = Get-Date $meeting.Start
                Subject   = $meeting.Subject
                TeamsLink = $matches[0]
            }
        }
    }

    # Sort the final list and export to CSV with a semicolon delimiter.
    $meetingsOutput | Sort-Object -Property StartTime | Export-Csv -Path $OutputPath -NoTypeInformation -Encoding UTF8 -Delimiter ';'
    
    Write-Host "Success: $($meetingsOutput.Count) Teams meetings exported to $OutputPath"

}
catch {
    # The "$_" contains the actual error from PowerShell
    Write-Error "An error occurred: $_"
    Write-Error "Please ensure Microsoft Outlook is running or can be started."
}
finally {
    # Cleanly release all COM objects to prevent Outlook from staying open in the background.
    # The $meetingsOutput object is a PowerShell array, not a COM object, so it is not released here.
    if ($restrictedAppointments) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($restrictedAppointments) | Out-Null }
    if ($allAppointments) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($allAppointments) | Out-Null }
    if ($calendar) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($calendar) | Out-Null }
    if ($namespace) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($namespace) | Out-Null }
    if ($outlook) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($outlook) | Out-Null }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
