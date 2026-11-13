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
 * Format a JSON value as a Python literal.
 */
function pythonLiteral(value: unknown): string {
  if (value === null || value === undefined) {
    return "None";
  }
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "None";
  }
  if (typeof value === "string") {
    // a JSON string literal is also a valid Python string literal
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(pythonLiteral).join(", ")}]`;
  }
  return `{${Object.entries(value as {[key: string]: unknown}).map(([k, v]) => `${JSON.stringify(k)}: ${pythonLiteral(v)}`).join(", ")}}`;
}

/**
 * Format the kwargs of a resource as a Python dict literal.
 *
 * @param kwargs The kwargs of the resource, as an object or a JSON string
 * @returns A Python dict literal, `{}` if there are no (valid) kwargs
 */
export function pythonKwargs(kwargs: unknown): string {
  if (typeof kwargs === "string") {
    if (kwargs.trim() === "") {
      return "{}";
    }
    try {
      kwargs = JSON.parse(kwargs);
    } catch {
      return "{}";
    }
  }
  if (kwargs === null || typeof kwargs !== "object" || Array.isArray(kwargs)) {
    return "{}";
  }
  return pythonLiteral(kwargs);
}

/**
 * Instantiate the template of a snippet.
 *
 * @param template The template to instantiate
 * @param url The url of the resource the entry belongs to
 * @param type The type of the resource the entry belongs to
 * @param pathstr The path of the entry, including the drive
 * @param kwargs The kwargs of the resource, as an object or a JSON string
 */
export function instantiateSnippet(template: string, url: string, type: string, pathstr: string, kwargs?: unknown) {
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
    kwargs: pythonKwargs(kwargs),
  };

  let templated = template;
  for (const key of Object.keys(args) as Array<keyof typeof args>) {
    if (!(key in templateTokenFinders)) {
      // match `key` wrapped in double curly-braces (and optionally whitespace padding within the braces)
      templateTokenFinders[key] = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    }
    // use a function, so that `$` in the value is not treated as a replacement pattern
    templated = templated.replace(templateTokenFinders[key], () => args[key]);
  }
  return templated;
}
