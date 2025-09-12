/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Meetings File Path - The full path to your meetings CSV file. Use ~ for your home directory. */
  "meetingsFilePath": string,
  /** PowerShell Script Path - Path to the PowerShell script that contains the meeting extraction function. Use ~ for your home directory. */
  "powershellScriptPath": string,
  /** PowerShell Function Name - Name of the PowerShell function to call for refreshing meetings (e.g., 'Get-TeamsMeetings') */
  "powershellFunctionName": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `find-meetings` command */
  export type FindMeetings = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `find-meetings` command */
  export type FindMeetings = {}
}

