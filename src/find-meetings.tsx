import { Action, ActionPanel, Icon, List, showToast, Toast, getPreferenceValues } from "@raycast/api";
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
                return {
                    StartTime: parts[0],
                    Subject: parts[1],
                    TeamsLink: parts[2],
                };
            })
            .filter((m) => m.StartTime && m.Subject && m.TeamsLink); // Ensure all fields are valid

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

    return (
        <List isLoading={isLoading} searchBarPlaceholder="Filter today's meetings...">
            {meetings.length > 0 ? (
                meetings.map((meeting, index) => (
                    <List.Item
                        key={`${meeting.TeamsLink}-${index}`}
                        title={meeting.Subject}
                        subtitle={meeting.StartTime}
                        icon={Icon.Calendar}
                        actions={
                            <ActionPanel>
                                <Action
                                    title="Join Teams Meeting"
                                    icon={Icon.Video}
                                    onAction={() => openTeamsLink(meeting.TeamsLink)}
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