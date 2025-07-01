import { Action, ActionPanel, Icon, List, showToast, Toast, open, getPreferenceValues } from "@raycast/api";
import { useEffect, useState } from "react";
import { homedir } from "os";
import { readFile } from "fs/promises";
import { join } from "path";

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
                                    onAction={() => open(meeting.TeamsLink.replace("https://", "msteams://"))}
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