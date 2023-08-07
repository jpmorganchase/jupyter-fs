/******************************************************************************
 *
 * Copyright (c) 2023, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import { URLExt } from "@jupyterlab/coreutils";
import { ServerConnection } from "@jupyterlab/services";
import { ISettingRegistry } from "@jupyterlab/settingregistry";


interface RawSnippet {
  label: string;
  caption: string;
  pattern: string;
  template: string;
}

interface ISnippetsResponse {
  snippets: RawSnippet[];
}

const processUrlRegex = /^(?<protocol>.+?):\/\/(?:[^@]+@)?(?<resource>.*)$/;
const templateTokenFinders = {} as {[key: string]: RegExp};


/**
 * A usage snippet specification
 */
export interface Snippet {
  /**
   * The designator to show to users
   */
  label: string;

  /**
   * An optional, longer description to show to users
   */
  caption: string;

  /**
   * A regular expression to match against the full URL of the entry, indicating if this snippet is valid for it
   */
  pattern: RegExp;

  /**
   * A template string to build up the snippet
   */
  template: string;
}


/**
 * Get all the snippet specifications in the settings
 */
export function getSettingsSnippets(settings?: ISettingRegistry.ISettings): Snippet[] {
  const raw = (settings?.composite.snippets ?? []) as any as RawSnippet[];
  return raw.map(s => ({ ...s, pattern: new RegExp(s.pattern) }));
}

/**
 * Sends a GET request to obtain all existing profile names in Neptune
 */
export async function getServerSnippets(settings?: ServerConnection.ISettings): Promise<Snippet[]> {
  if (!settings) {
    settings = ServerConnection.makeSettings();
  }
  return ServerConnection.makeRequest(
    URLExt.join(settings.baseUrl, "/jupyterfs/snippets"),
    { method: "GET" },
    settings
  ).then(response => {
    if (!response.ok) {
      return Promise.reject(response);
    }
    return response.json() as Promise<ISnippetsResponse>;
  }).then(data => data.snippets.map(s => ({ ...s, pattern: new RegExp(s.pattern) })));
}

/**
 * Get the snippet specifications from all sources
 */
export async function getAllSnippets(settings?: ISettingRegistry.ISettings): Promise<Snippet[]> {
  return (await getServerSnippets()).concat(getSettingsSnippets(settings));
}


/**
 * Instantiate the template of a snippet.
 *
 * @param template The template to instantiate
 * @param resource The resource the entry belongs to
 * @param path The local path of the entry
 */
export function instantiateSnippet(template: string, url: string, pathstr: string) {
  const parsed = processUrlRegex.exec(url);
  // eslint-disable-next-line prefer-const
  const splitloc = pathstr.indexOf("/");
  const drive = splitloc !== -1 ? pathstr.slice(0, splitloc) : pathstr;
  let relativePath = splitloc !== -1 ? pathstr.slice(splitloc + 1) : "";
  relativePath = relativePath.replace(/^\//g, "");  // trim all leading "/"
  const args = {
    ...parsed?.groups,
    url,
    path: relativePath,
    full_url: `${url.replace(/\/$/, "")}/${relativePath}`,
    full_path: `${drive}:/${relativePath}`,
    drive,
  };

  let templated = template;
  for (const key of Object.keys(args) as Array<keyof typeof args>) {
    if (!(key in templateTokenFinders)) {
      templateTokenFinders[key] = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    }
    templated = templated.replace(templateTokenFinders[key], args[key]);
  }
  return templated;
}
