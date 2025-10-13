import {
    Action,
    ActionPanel,
    Icon,
    List,
    showToast,
    Toast,
    getPreferenceValues,
    Clipboard,
    environment,
} from "@raycast/api"
import { useEffect, useState } from "react"
import { homedir } from "os"
import { readFile, stat } from "fs/promises"
import { exec } from "child_process"
import { promisify } from "util"
import { join } from "path"

const execAsync = promisify(exec)

/**
 * Checks if a file is older than 24 hours
 * @param filePath Path to the file to check
 * @returns Promise<boolean> True if file is older than 24 hours or doesn't exist
 */
async function isFileOlderThan24Hours(filePath: string): Promise<boolean> {
    try {
        const stats = await stat(filePath)
        const fileAge = Date.now() - stats.mtime.getTime()
        const twentyFourHours = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
        return fileAge > twentyFourHours
    } catch (error) {
        // If file doesn't exist or can't be accessed, consider it "old"
        return true
    }
}

// Meeting status enum
enum MeetingStatus {
    Ended = "ended",
    Active = "active",
    Upcoming = "upcoming",
}

// Function to determine meeting status based on start/end times
function getMeetingStatus(startDate: Date, endDate?: Date): MeetingStatus {
    const now = new Date()
    const fiveMinuteBuffer = 5 * 60 * 1000 // 5 minutes in milliseconds

    if (endDate && now > endDate) {
        return MeetingStatus.Ended
    }

    // Consider meeting active if we're within 5 minutes of start time or after start time
    if (now >= new Date(startDate.getTime() - fiveMinuteBuffer)) {
        if (endDate) {
            return now <= endDate ? MeetingStatus.Active : MeetingStatus.Ended
        } else {
            // If no end time, assume meeting is active for 1 hour after start
            const assumedEndTime = new Date(startDate.getTime() + 60 * 60 * 1000)
            return now <= assumedEndTime ? MeetingStatus.Active : MeetingStatus.Ended
        }
    }

    return MeetingStatus.Upcoming
}

// Function to get appropriate icon for meeting status
function getStatusIcon(status: MeetingStatus): Icon {
    switch (status) {
        case MeetingStatus.Active:
            return Icon.CircleFilled
        case MeetingStatus.Upcoming:
            return Icon.Circle
        case MeetingStatus.Ended:
            return Icon.CircleProgress100
        default:
            return Icon.Calendar
    }
}

// Function to get status color/accessory
function getStatusAccessory(status: MeetingStatus): { icon: Icon; tooltip: string } {
    switch (status) {
        case MeetingStatus.Active:
            return { icon: Icon.CircleFilled, tooltip: "Meeting is active" }
        case MeetingStatus.Upcoming:
            return { icon: Icon.Circle, tooltip: "Upcoming meeting" }
        case MeetingStatus.Ended:
            return { icon: Icon.CircleProgress100, tooltip: "Meeting has ended" }
        default:
            return { icon: Icon.Calendar, tooltip: "Meeting" }
    }
}

// Interface for storing meeting information
interface MeetingInfo {
    StartTime: string
    Subject: string
    TeamsLink: string
    parsedDate: Date
    endDate?: Date
    timeDisplay: string
    status: MeetingStatus
}

// Interface for grouped meetings by date
interface GroupedMeetings {
    [dateKey: string]: MeetingInfo[]
}

// Interface for the extension's preferences
interface Preferences {
    meetingsFilePath?: string
    powershellScriptPath?: string
    powershellFunctionName?: string
}

// Filter options for meetings
enum FilterOption {
    All = "all",
    UpcomingAndActive = "upcoming-active",
}

/**
 * Opens the Teams link in the desktop client using the Windows 'start' command.
 * @param url The original https Teams meeting URL.
 */
async function openTeamsLink(url: string) {
    const teamsUrl = url.replace("https://", "msteams://")

    try {
        // The 'start' command is a reliable way to open custom URL protocols on Windows.
        // The empty "" argument is a necessary quirk to handle URLs correctly.
        await execAsync(`start "" "${teamsUrl}"`)
    } catch (error) {
        await showToast({
            style: Toast.Style.Failure,
            title: "Failed to Open Link",
            message: `Could not open the Teams link. Please ensure Teams is installed.`,
        })
    }
}

/**
 * Executes a PowerShell function to refresh the meetings CSV file.
 * @param scriptPath Path to the PowerShell script (if empty, uses bundled script)
 * @param functionName Name of the PowerShell function to execute (if empty, uses 'extract-meetings')
 */
async function refreshMeetingsWithPowerShell(scriptPath: string, functionName: string) {
    try {
        // Use bundled script if no custom path provided
        let expandedScriptPath: string
        if (!scriptPath || scriptPath.trim() === "") {
            // Use the bundled script from the extension's assets directory
            expandedScriptPath = join(environment.assetsPath, "..", "extract_teams_meetings.ps1")
        } else {
            // Expand tilde in custom script path if present
            expandedScriptPath = scriptPath.replace("~", homedir())
        }

        // Use default function name if not provided
        const actualFunctionName = !functionName || functionName.trim() === "" ? "extract-meetings" : functionName

        // Build PowerShell command to source the script and call the function
        const psCommand = `powershell.exe -ExecutionPolicy Bypass -Command "& { . '${expandedScriptPath}'; ${actualFunctionName} }"`

        await execAsync(psCommand)

        await showToast({
            style: Toast.Style.Success,
            title: "Meetings Refreshed",
            message: "Successfully updated meetings from PowerShell script",
        })
    } catch (error) {
        await showToast({
            style: Toast.Style.Failure,
            title: "PowerShell Refresh Failed",
            message: error instanceof Error ? error.message : "Failed to execute PowerShell script",
        })
    }
}

// Fetches meetings from the specified CSV file path.
async function fetchMeetings(filePath: string): Promise<MeetingInfo[]> {
    try {
        const fileContent = await readFile(filePath, "utf-8")

        // Parse the CSV content
        const meetings: MeetingInfo[] = fileContent
            .trim()
            .split(/\r?\n/)
            .slice(1) // Skip header row
            .map(line => {
                const parts = line.split(";")

                // Try parsing the date with different strategies
                let parsedDate = new Date(parts[0])

                // If that fails, try parsing common formats like "DD/MM/YYYY HH:MM" or "DD, MM, YYYY HH:MM"
                if (isNaN(parsedDate.getTime())) {
                    // Handle formats like "28, 08, 2025 14:30" or "28/08/2025 14:30"
                    const dateTimeStr = parts[0].replace(/,/g, "/") // Replace commas with slashes
                    parsedDate = new Date(dateTimeStr)

                    // If still invalid, try swapping day/month for DD/MM/YYYY format
                    if (isNaN(parsedDate.getTime())) {
                        const match = parts[0].match(/(\d{1,2})[,/]\s*(\d{1,2})[,/]\s*(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/)
                        if (match) {
                            const [, day, month, year, hour = "0", minute = "0"] = match
                            parsedDate = new Date(
                                parseInt(year),
                                parseInt(month) - 1,
                                parseInt(day),
                                parseInt(hour),
                                parseInt(minute),
                            )
                        }
                    }
                }

                const isValidDate = !isNaN(parsedDate.getTime())
                const validParsedDate = isValidDate ? parsedDate : new Date()

                // Calculate end date (assume 1 hour duration if not provided)
                // You could extend this to parse end time from CSV if available
                const endDate = new Date(validParsedDate.getTime() + 60 * 60 * 1000)

                return {
                    StartTime: parts[0],
                    Subject: parts[1],
                    TeamsLink: parts[2],
                    parsedDate: validParsedDate,
                    endDate,
                    timeDisplay: isValidDate
                        ? parsedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : parts[0], // Fallback to original string if date parsing fails
                    status: getMeetingStatus(validParsedDate, endDate),
                }
            })
            .filter(m => m.StartTime && m.Subject && m.TeamsLink) // Remove the date validation that was causing issues
            .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime()) // Sort by start time

        return meetings
    } catch (error) {
        console.error("Error reading or parsing CSV file:", error)
        throw new Error(`Could not read or find the file at: ${filePath}`)
    }
}

export default function Command() {
    const [meetings, setMeetings] = useState<MeetingInfo[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [filter, setFilter] = useState<FilterOption>(FilterOption.All)
    const preferences = getPreferenceValues<Preferences>()
    // Use default path if preference is not set
    const defaultMeetingsPath = join(homedir(), "meetings.csv")
    const meetingsFilePath = (preferences.meetingsFilePath || defaultMeetingsPath).replace("~", homedir())

    // Filter meetings based on dropdown selection
    const filteredMeetings =
        filter === FilterOption.UpcomingAndActive
            ? meetings.filter(meeting => meeting.status !== MeetingStatus.Ended)
            : meetings

    // Group meetings by date
    const groupedMeetings = filteredMeetings.reduce<GroupedMeetings>((groups, meeting) => {
        const dateKey = meeting.parsedDate.toDateString()
        if (!groups[dateKey]) {
            groups[dateKey] = []
        }
        groups[dateKey].push(meeting)
        return groups
    }, {})

    // Get sorted date keys for consistent ordering
    const sortedDateKeys = Object.keys(groupedMeetings).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

    // Function to load or reload the meeting list
    const loadMeetings = async (skipAgeCheck = false) => {
        const toast = await showToast({
            style: Toast.Style.Animated,
            title: "Loading meetings...",
        })

        try {
            setIsLoading(true)

            // Check if file is older than 24 hours and auto-refresh if needed
            if (!skipAgeCheck) {
                const isOld = await isFileOlderThan24Hours(meetingsFilePath)
                if (isOld) {
                    toast.title = "File is outdated, refreshing..."
                    toast.message = "Meetings file is older than 24 hours, updating automatically"

                    try {
                        await refreshMeetingsWithPowerShell(
                            preferences.powershellScriptPath || "",
                            preferences.powershellFunctionName || "",
                        )

                        await showToast({
                            style: Toast.Style.Success,
                            title: "File Updated",
                            message: "Meetings file has been automatically refreshed",
                        })
                    } catch (refreshError) {
                        await showToast({
                            style: Toast.Style.Failure,
                            title: "Auto-refresh Failed",
                            message: "Could not auto-refresh meetings file, loading existing file",
                        })
                    }
                }
            }

            const fetchedMeetings = await fetchMeetings(meetingsFilePath)
            setMeetings(fetchedMeetings)

            toast.style = Toast.Style.Success
            toast.title = "Meetings Loaded"
            toast.message = `Found ${fetchedMeetings.length} meetings.`
        } catch (error) {
            toast.style = Toast.Style.Failure
            toast.title = "Error Fetching Meetings"
            toast.message = error instanceof Error ? error.message : "An unknown error occurred"
            setMeetings([]) // Clear meetings on error
        } finally {
            setIsLoading(false)
        }
    }

    // Function to refresh meetings using PowerShell script
    const refreshMeetings = async () => {
        const toast = await showToast({
            style: Toast.Style.Animated,
            title: "Refreshing meetings with PowerShell...",
        })

        try {
            // First run the PowerShell script to update the CSV
            await refreshMeetingsWithPowerShell(
                preferences.powershellScriptPath || "",
                preferences.powershellFunctionName || "",
            )

            // Then reload the meetings from the updated CSV (skip age check since we just refreshed)
            await loadMeetings(true)
        } catch (error) {
            toast.style = Toast.Style.Failure
            toast.title = "Refresh Failed"
            toast.message = error instanceof Error ? error.message : "Failed to refresh meetings"
        }
    }

    // useEffect with an empty dependency array runs only once on mount
    useEffect(() => {
        loadMeetings()
    }, [])

    const formatDateSection = (dateKey: string): string => {
        const date = new Date(dateKey)
        const today = new Date()
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        if (date.toDateString() === today.toDateString()) {
            return "Today"
        } else if (date.toDateString() === tomorrow.toDateString()) {
            return "Tomorrow"
        } else {
            return date.toLocaleDateString([], {
                weekday: "long",
                month: "short",
                day: "numeric",
            })
        }
    }

    return (
        <List
            isLoading={isLoading}
            searchBarPlaceholder="Filter meetings..."
            searchBarAccessory={
                <List.Dropdown
                    tooltip="Filter meetings"
                    value={filter}
                    onChange={newValue => setFilter(newValue as FilterOption)}
                >
                    <List.Dropdown.Item title="All Meetings" value={FilterOption.All} />
                    <List.Dropdown.Item title="Upcoming & Active" value={FilterOption.UpcomingAndActive} />
                </List.Dropdown>
            }
        >
            {filteredMeetings.length > 0 ? (
                sortedDateKeys.map(dateKey => (
                    <List.Section key={dateKey} title={formatDateSection(dateKey)}>
                        {groupedMeetings[dateKey].map((meeting, index) => (
                            <List.Item
                                key={`${meeting.TeamsLink}-${index}`}
                                title={meeting.Subject}
                                subtitle={meeting.timeDisplay}
                                icon={getStatusIcon(meeting.status)}
                                accessories={[getStatusAccessory(meeting.status)]}
                                actions={
                                    <ActionPanel>
                                        <Action
                                            title="Join Teams Meeting"
                                            icon={Icon.Video}
                                            onAction={() => openTeamsLink(meeting.TeamsLink)}
                                            shortcut={{
                                                macOS: { modifiers: ["cmd"], key: "j" },
                                                windows: { modifiers: ["ctrl"], key: "j" },
                                            }}
                                        />
                                        <Action
                                            title="Copy Meeting Link"
                                            icon={Icon.CopyClipboard}
                                            onAction={async () => {
                                                await Clipboard.copy(meeting.TeamsLink)
                                                await showToast({
                                                    style: Toast.Style.Success,
                                                    title: "Link Copied",
                                                    message: "Teams meeting link copied to clipboard",
                                                })
                                            }}
                                            shortcut={{
                                                macOS: { modifiers: ["cmd"], key: "c" },
                                                windows: { modifiers: ["ctrl"], key: "c" },
                                            }}
                                        />
                                        <Action
                                            title="Reload Meetings"
                                            icon={Icon.Repeat}
                                            onAction={() => loadMeetings(true)}
                                            shortcut={{
                                                macOS: { modifiers: ["cmd"], key: "r" },
                                                windows: { modifiers: ["ctrl"], key: "r" },
                                            }}
                                        />
                                        <Action
                                            title="Refresh with Powershell"
                                            icon={Icon.Terminal}
                                            onAction={refreshMeetings}
                                            shortcut={{
                                                macOS: { modifiers: ["cmd", "shift"], key: "r" },
                                                windows: { modifiers: ["ctrl", "shift"], key: "r" },
                                            }}
                                        />
                                    </ActionPanel>
                                }
                            />
                        ))}
                    </List.Section>
                ))
            ) : (
                <List.EmptyView
                    title={isLoading ? "Loading Meetings..." : "No Meetings Found"}
                    description={
                        isLoading
                            ? "Please wait..."
                            : filter === FilterOption.UpcomingAndActive && meetings.length > 0
                              ? "All meetings have ended. Change filter to 'All Meetings' to see them."
                              : `Could not find any meetings in the specified file.`
                    }
                    icon={Icon.Calendar}
                />
            )}
        </List>
    )
}
