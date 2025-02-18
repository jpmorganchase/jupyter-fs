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
import * as React from "react";

import type { FieldProps } from "@rjsf/utils";
import { splitPathstrDrive } from "./contents_utils";

function _mknode(obj: any, paths: string[]) {
  for (const path of paths) {
    obj = obj[path] = obj[path] ?? {};
  }
  return obj;
}

/**
 * Trick to set uiSchema on our settings editor form elements.
 *
 * We use it to set the "template" to a "textarea" multiline input
 */
export function snippetFormRender(props: FieldProps) {
  const ArrayField = props.registry.fields.ArrayField;
  const uiSchema = { ...props.uiSchema };
  const templateUiSchema = _mknode(uiSchema, ["items", "template"]);
  templateUiSchema["ui:widget"] = "textarea";
  return <ArrayField {...props} uiSchema={uiSchema} />;
}


export interface RawSnippet {
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

  /**
   * A template string to build up the snippet
   */
  type?: string;
}


/**
 * Get all the snippet specifications in the settings
 */
export function getSettingsSnippets(settings?: ISettingRegistry.ISettings): Snippet[] {
  const raw = (settings?.composite.snippets ?? []) as any as RawSnippet[];
  return raw.map(s => ({ ...s, pattern: new RegExp(s.pattern) }));
}

/**
 * Gets all the snippet specifications configured on the server
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
export function instantiateSnippet(template: string, url: string, type: string, pathstr: string) {
  const parsed = processUrlRegex.exec(url);
  const [drive, relativePath] = splitPathstrDrive(pathstr);
  const args = {
    ...parsed?.groups,
    url,
    type,
    path: relativePath,
    full_url: `${url.replace(/\/$/, "")}/${relativePath}`,
    full_path: `${drive}:/${relativePath}`,
    drive,
  };

  let templated = template;
  for (const key of Object.keys(args) as Array<keyof typeof args>) {
    if (!(key in templateTokenFinders)) {
      // match `key` wrapped in double curly-braces (and optionally whitespace padding within the braces)
      templateTokenFinders[key] = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    }
    templated = templated.replace(templateTokenFinders[key], args[key]);
  }
  return templated;
}
