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
import { readFile, stat, access } from "fs/promises"
import { exec } from "child_process"
import { constants } from "fs"
import { promisify } from "util"
import { join } from "path"

const execAsync = promisify(exec)

/**
 * Checks if a file exists
 * @param filePath Path to the file to check
 * @returns Promise<boolean> True if file exists and is accessible
 */
async function fileExists(filePath: string): Promise<boolean> {
    try {
        await access(filePath, constants.F_OK)
        return true
    } catch {
        return false
    }
}

/**
 * Checks if a file is older than the specified number of hours
 * @param filePath Path to the file to check
 * @param hours Number of hours to check against (0 disables check)
 * @returns Promise<boolean> True if file is older than specified hours or doesn't exist
 */
async function isFileOlderThanHours(filePath: string, hours: number): Promise<boolean> {
    // If hours is 0 or negative, auto-refresh is disabled
    if (hours <= 0) {
        return false
    }

    try {
        const stats = await stat(filePath)
        const fileAge = Date.now() - stats.mtime.getTime()
        const thresholdMs = hours * 60 * 60 * 1000 // Convert hours to milliseconds
        return fileAge > thresholdMs
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
            return Icon.Video
        case MeetingStatus.Upcoming:
            return Icon.Calendar
        case MeetingStatus.Ended:
            return Icon.CheckCircle
        default:
            return Icon.Calendar
    }
}

// Function to get status text/accessory
function getStatusAccessory(status: MeetingStatus): { text: string; tooltip: string } {
    switch (status) {
        case MeetingStatus.Active:
            return { text: "Active", tooltip: "Meeting is active" }
        case MeetingStatus.Upcoming:
            return { text: "Upcoming", tooltip: "Upcoming meeting" }
        case MeetingStatus.Ended:
            return { text: "Done", tooltip: "Meeting has ended" }
        default:
            return { text: "Meeting", tooltip: "Meeting" }
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
    autoRefreshHours?: string
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
    // Use bundled script if no custom path provided
    let expandedScriptPath: string
    if (!scriptPath || scriptPath.trim() === "") {
        // Try multiple locations for the bundled script
        const possiblePaths = [
            join(environment.assetsPath, "extract_teams_meetings.ps1"),
            join(environment.assetsPath, "..", "extract_teams_meetings.ps1"),
            join(environment.assetsPath, "..", "..", "extract_teams_meetings.ps1"),
        ]

        console.log("Looking for bundled PowerShell script in:", possiblePaths)

        // Check which path exists
        let foundPath: string | null = null
        for (const path of possiblePaths) {
            if (await fileExists(path)) {
                foundPath = path
                console.log("Found bundled script at:", path)
                break
            }
        }

        if (!foundPath) {
            const errorMsg = `Bundled PowerShell script not found. Searched in: ${possiblePaths.join(", ")}`
            console.error(errorMsg)
            throw new Error(errorMsg)
        }

        expandedScriptPath = foundPath
    } else {
        // Expand tilde in custom script path if present
        expandedScriptPath = scriptPath.replace("~", homedir())
    }

    // Use default function name if not provided
    const actualFunctionName = !functionName || functionName.trim() === "" ? "extract-meetings" : functionName

    // Build PowerShell command to source the script and call the function
    const psCommand = `powershell.exe -ExecutionPolicy Bypass -Command "& { . '${expandedScriptPath}'; ${actualFunctionName} }"`

    console.log("Executing PowerShell command:", psCommand)
    console.log("Script path:", expandedScriptPath)
    console.log("Function name:", actualFunctionName)

    const { stdout, stderr } = await execAsync(psCommand)

    console.log("PowerShell stdout:", stdout)
    if (stderr) {
        console.error("PowerShell stderr:", stderr)
    }

    await showToast({
        style: Toast.Style.Success,
        title: "Meetings Refreshed",
        message: "Successfully updated meetings from PowerShell script",
    })
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
    // Parse auto-refresh hours (default to 24 if not set or invalid)
    const autoRefreshHours = parseInt(preferences.autoRefreshHours || "24", 10) || 24

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

            // Check if file exists first
            const exists = await fileExists(meetingsFilePath)
            if (!exists) {
                toast.title = "Meetings file not found"
                toast.message = "Creating meetings file with PowerShell script..."
                console.log("Meetings file not found at:", meetingsFilePath)

                try {
                    await refreshMeetingsWithPowerShell(
                        preferences.powershellScriptPath || "",
                        preferences.powershellFunctionName || "",
                    )

                    // Verify the file was actually created
                    const fileCreated = await fileExists(meetingsFilePath)
                    if (!fileCreated) {
                        const errorMsg = `PowerShell script completed but file was not created at: ${meetingsFilePath}`
                        console.error(errorMsg)
                        toast.style = Toast.Style.Failure
                        toast.title = "Failed to Create Meetings File"
                        toast.message = errorMsg
                        setMeetings([])
                        setIsLoading(false)
                        return
                    }

                    console.log("Meetings file successfully created")
                    toast.style = Toast.Style.Success
                    toast.title = "Meetings File Created"
                    toast.message = "Successfully created meetings file"
                } catch (refreshError) {
                    const errorMsg = refreshError instanceof Error ? refreshError.message : "Unknown error"
                    console.error("PowerShell script execution failed:", errorMsg)
                    console.error("Full error:", refreshError)
                    toast.style = Toast.Style.Failure
                    toast.title = "PowerShell Script Failed"
                    toast.message = errorMsg
                    setMeetings([])
                    setIsLoading(false)
                    return
                }
            }

            // Check if file is older than configured hours and auto-refresh if needed
            if (!skipAgeCheck) {
                const isOld = await isFileOlderThanHours(meetingsFilePath, autoRefreshHours)
                if (isOld) {
                    toast.title = "File is outdated, refreshing..."
                    toast.message = `Meetings file is older than ${autoRefreshHours} hours, updating automatically`

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

            // Final check to ensure file exists before fetching
            const fileStillExists = await fileExists(meetingsFilePath)
            if (!fileStillExists) {
                const errorMsg = `File does not exist at: ${meetingsFilePath}`
                console.error(errorMsg)
                toast.style = Toast.Style.Failure
                toast.title = "Meetings File Not Found"
                toast.message = errorMsg
                setMeetings([])
                setIsLoading(false)
                return
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
                              : "No meetings found for today. The extension will automatically check for new meetings."
                    }
                    icon={Icon.Calendar}
                    actions={
                        !isLoading && (
                            <ActionPanel>
                                <Action
                                    title="Refresh with Powershell"
                                    icon={Icon.Terminal}
                                    onAction={refreshMeetings}
                                    shortcut={{
                                        macOS: { modifiers: ["cmd", "shift"], key: "r" },
                                        windows: { modifiers: ["ctrl", "shift"], key: "r" },
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
                            </ActionPanel>
                        )
                    }
                />
            )}
        </List>
    )
}
