import { Action, ActionPanel, Icon, List, showToast, Toast, getPreferenceValues, Clipboard } from "@raycast/api";
import { useEffect, useState } from "react";
import { homedir } from "os";
import { readFile } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Interface for storing meeting information
interface MeetingInfo {
    StartTime: string;
    Subject: string;
    TeamsLink: string;
    parsedDate: Date;
    timeDisplay: string;
}

// Interface for grouped meetings by date
interface GroupedMeetings {
    [dateKey: string]: MeetingInfo[];
}

// Interface for the extension's preferences
interface Preferences {
    meetingsFilePath: string;
}

/**
 * Opens the Teams link in the desktop client using the Windows 'start' command.
 * @param url The original https Teams meeting URL.
 */
async function openTeamsLink(url: string) {
    const teamsUrl = url.replace("https://", "msteams://");

    try {
        // The 'start' command is a reliable way to open custom URL protocols on Windows.
        // The empty "" argument is a necessary quirk to handle URLs correctly.
        await execAsync(`start "" "${teamsUrl}"`);
    } catch (error) {
        await showToast({
            style: Toast.Style.Failure,
            title: "Failed to Open Link",
            message: `Could not open the Teams link. Please ensure Teams is installed.`,
        });
    }
}

// Fetches meetings from the specified CSV file path.
async function fetchTodaysMeetings(filePath: string): Promise<MeetingInfo[]> {
    try {
        const fileContent = await readFile(filePath, "utf-8");

        // Parse the CSV content
        const meetings: MeetingInfo[] = fileContent
            .trim()
            .split(/\r?\n/)
            .slice(1) // Skip header row
            .map((line) => {
                const parts = line.split(";");
                
                // Try parsing the date with different strategies
                let parsedDate = new Date(parts[0]);
                
                // If that fails, try parsing common formats like "DD/MM/YYYY HH:MM" or "DD, MM, YYYY HH:MM"
                if (isNaN(parsedDate.getTime())) {
                    // Handle formats like "28, 08, 2025 14:30" or "28/08/2025 14:30"
                    const dateTimeStr = parts[0].replace(/,/g, '/'); // Replace commas with slashes
                    parsedDate = new Date(dateTimeStr);
                    
                    // If still invalid, try swapping day/month for DD/MM/YYYY format
                    if (isNaN(parsedDate.getTime())) {
                        const match = parts[0].match(/(\d{1,2})[,\/]\s*(\d{1,2})[,\/]\s*(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
                        if (match) {
                            const [, day, month, year, hour = '0', minute = '0'] = match;
                            parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
                        }
                    }
                }
                
                const isValidDate = !isNaN(parsedDate.getTime());
                
                return {
                    StartTime: parts[0],
                    Subject: parts[1],
                    TeamsLink: parts[2],
                    parsedDate: isValidDate ? parsedDate : new Date(),
                    timeDisplay: isValidDate 
                        ? parsedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : parts[0], // Fallback to original string if date parsing fails
                };
            })
            .filter((m) => m.StartTime && m.Subject && m.TeamsLink) // Remove the date validation that was causing issues
            .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime()); // Sort by start time

        return meetings;
    } catch (error) {
        console.error("Error reading or parsing CSV file:", error);
        throw new Error(`Could not read or find the file at: ${filePath}`);
    }
}

export default function Command() {
    const [meetings, setMeetings] = useState<MeetingInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const preferences = getPreferenceValues<Preferences>();
    const meetingsFilePath = preferences.meetingsFilePath.replace("~", homedir());

    // Group meetings by date
    const groupedMeetings = meetings.reduce<GroupedMeetings>((groups, meeting) => {
        const dateKey = meeting.parsedDate.toDateString();
        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(meeting);
        return groups;
    }, {});

    // Get sorted date keys for consistent ordering
    const sortedDateKeys = Object.keys(groupedMeetings).sort((a, b) => 
        new Date(a).getTime() - new Date(b).getTime()
    );

    // Function to load or reload the meeting list
    const loadMeetings = async () => {
        const toast = await showToast({
            style: Toast.Style.Animated,
            title: "Loading meetings...",
        });

        try {
            setIsLoading(true);
            const fetchedMeetings = await fetchTodaysMeetings(meetingsFilePath);
            setMeetings(fetchedMeetings);

            toast.style = Toast.Style.Success;
            toast.title = "Meetings Loaded";
            toast.message = `Found ${fetchedMeetings.length} meetings.`;
        } catch (error) {
            toast.style = Toast.Style.Failure;
            toast.title = "Error Fetching Meetings";
            toast.message = error instanceof Error ? error.message : "An unknown error occurred";
            setMeetings([]); // Clear meetings on error
        } finally {
            setIsLoading(false);
        }
    };

    // useEffect with an empty dependency array runs only once on mount
    useEffect(() => {
        loadMeetings();
    }, []);

    const formatDateSection = (dateKey: string): string => {
        const date = new Date(dateKey);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.toDateString() === today.toDateString()) {
            return "Today";
        } else if (date.toDateString() === tomorrow.toDateString()) {
            return "Tomorrow";
        } else {
            return date.toLocaleDateString([], { 
                weekday: 'long', 
                month: 'short', 
                day: 'numeric' 
            });
        }
    };

    return (
        <List isLoading={isLoading} searchBarPlaceholder="Filter meetings...">
            {meetings.length > 0 ? (
                sortedDateKeys.map((dateKey) => (
                    <List.Section key={dateKey} title={formatDateSection(dateKey)}>
                        {groupedMeetings[dateKey].map((meeting, index) => (
                            <List.Item
                                key={`${meeting.TeamsLink}-${index}`}
                                title={meeting.Subject}
                                subtitle={meeting.timeDisplay}
                                icon={Icon.Calendar}
                                actions={
                                    <ActionPanel>
                                        <Action
                                            title="Join Teams Meeting"
                                            icon={Icon.Video}
                                            onAction={() => openTeamsLink(meeting.TeamsLink)}
                                        />
                                        <Action
                                            title="Copy Meeting Link"
                                            icon={Icon.CopyClipboard}
                                            onAction={async () => {
                                                await Clipboard.copy(meeting.TeamsLink);
                                                await showToast({
                                                    style: Toast.Style.Success,
                                                    title: "Link Copied",
                                                    message: "Teams meeting link copied to clipboard",
                                                });
                                            }}
                                            shortcut={{ modifiers: ["cmd"], key: "c" }}
                                        />
                                        <Action
                                            title="Reload Meetings"
                                            icon={Icon.Repeat}
                                            onAction={loadMeetings}
                                            shortcut={{ modifiers: ["cmd"], key: "r" }}
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
                            : `Could not find any meetings in the specified file.`
                    }
                    icon={Icon.Calendar}
                />
            )}
        </List>
    );
}