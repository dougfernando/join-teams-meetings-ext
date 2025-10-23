
function extract-meetings {
    $OutputPath = "$env:USERPROFILE\meetings.csv"

    try {
        # This requires the Outlook client to be running.
        $outlook = New-Object -ComObject Outlook.Application
        $namespace = $outlook.GetNamespace("MAPI")
        $calendar = $namespace.GetDefaultFolder(9) # olFolderCalendar
        $allAppointments = $calendar.Items
        $allAppointments.IncludeRecurrences = $true
        $allAppointments.Sort("[Start]")

        $startTime = (Get-Date).ToShortDateString()
        $endTime = (Get-Date).AddDays(5).ToShortDateString()
        $filter = "[Start] < '$endTime' AND [End] >= '$startTime'"
        $restrictedAppointments = $allAppointments.Restrict($filter)

        $upcomingMeetings = [System.Collections.Generic.List[object]]::new()
        foreach ($appointment in $restrictedAppointments) {
            if ($appointment.IsRecurring) {
                # For recurring appointments, we need to add the appointment itself
                # The IncludeRecurrences=true setting already expands them to individual instances
                $upcomingMeetings.Add($appointment)
            } else {
                $upcomingMeetings.Add($appointment)
            }
        }

        $meetingsOutput = [System.Collections.Generic.List[object]]::new()
        $teamsUrlRegex = [regex]'https://teams.microsoft.com/l/meetup-join/[^"'' >]+'
        foreach ($meeting in $upcomingMeetings) {
            $match = $teamsUrlRegex.Match($meeting.Body)
            if ($match.Success) {
                $meetingsOutput.Add([PSCustomObject]@{ 
                    StartTime = Get-Date $meeting.Start
                    Subject   = $meeting.Subject
                    TeamsLink = $match.Value
                })
            }
        }

        $meetingsOutput | Sort-Object -Property StartTime | Export-Csv -Path $OutputPath -NoTypeInformation -Encoding UTF8 -Delimiter ';'
        Write-Host "Success: $($meetingsOutput.Count) Teams meetings for the next 5 days exported to $OutputPath"

    } catch {
        Write-Error "An error occurred: $_"
        Write-Error "Please ensure Microsoft Outlook is running or can be started."
    } finally {
        # Clean up COM objects
        if ($restrictedAppointments) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($restrictedAppointments) | Out-Null }
        if ($allAppointments) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($allAppointments) | Out-Null }
        if ($calendar) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($calendar) | Out-Null }
        if ($namespace) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($namespace) | Out-Null }
        if ($outlook) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($outlook) | Out-Null }
        [GC]::Collect()
        [GC]::WaitForPendingFinalizers()
    }
}

