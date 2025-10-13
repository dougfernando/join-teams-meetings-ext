/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Meetings File Path - Path to your meetings CSV file. Use ~ for your home directory. Default works with bundled PowerShell script. */
  "meetingsFilePath": string,
  /** PowerShell Script Path (Optional) - Path to a custom PowerShell script. Leave empty to use the bundled script. Use ~ for your home directory. */
  "powershellScriptPath": string,
  /** PowerShell Function Name (Optional) - Name of the PowerShell function to call. Leave empty to use 'extract-meetings' (bundled script default). */
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

