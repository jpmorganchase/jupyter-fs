/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import { ISettingRegistry } from "@jupyterlab/settingregistry";
import * as semver from "semver";

import type { IFSOptions, IFSResource, IFSSettingsResource } from "./filesystem";
import type { RawSnippet } from "./snippets";

/**
 * Migrate any settings from an older version of the package
 *
 * @param settings Our settings to consider for migratation
 * @returns The modified settings object
 */
export async function migrateSettings(settings: ISettingRegistry.ISettings): Promise<ISettingRegistry.ISettings> {
  const options = settings?.composite.options as unknown as IFSOptions | undefined;
  if (semver.lt(options?.writtenVersion || "0.0.0", "0.4.0-alpha.8")) {
    // Migrate snippets to include defaults that were updated after version checked
    const defaultSnippets = (settings?.default("snippets") ?? []) as unknown as RawSnippet[];
    const defaultLabels = defaultSnippets.map( snippet => snippet.label );
    const userSnippets = (settings?.user.snippets ?? []) as unknown as RawSnippet[];

    // add the user defined snippets if they have different label to defaults
    const raw = userSnippets.reduce((combinedSnippetsArray, snippet) => {
      if (!defaultLabels.includes(snippet.label)) {
        combinedSnippetsArray.push(snippet);
      }
      return combinedSnippetsArray;
    }, [...defaultSnippets]) ?? [];

    await settings.set("snippets", raw as Array<Partial<RawSnippet>>);
  }

  // Update version
  await settings.set("options", {
    ...options,
    writtenVersion: settings.version,
  });
  return settings;
}


/**
 * Ensure undefined string values from settings that are required are translated to empty strings
 * @param settingsResoruce
 * @returns A filled in setting object
 */
export function unpartialResource(settingsResource: IFSSettingsResource): IFSResource {
  return { name: "", url: "", ...settingsResource };
}
