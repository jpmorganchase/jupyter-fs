/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */
import "isomorphic-fetch";

import {
  ISettingRegistry,
  SettingRegistry,
} from "@jupyterlab/settingregistry";
import { StateDB } from "@jupyterlab/statedb";
import { getServerSnippets, getSettingsSnippets, instantiateSnippet, snippetFormRender } from "../src/snippets";

import * as importedSchema from "../schema/plugin.json";
import { ServerConnection } from "@jupyterlab/services";

describe("instantiateSnippet", () => {
  const knownArgs = [
    "url",
    "type",
    "path",
    "full_url",
    "full_path",
    "drive",
    "protocol",
    "resource",
  ];

  it("should replace known parameters", () => {
    const pathstr = "drivename/full/path/file.txt";
    const url = "scheme://_:{{creds}}@url/path";
    const type =  "pyfs";

    const template = `{\n  ${knownArgs.map(arg => `"${arg}": "{{${arg}}}"`).join(",\n  ")}\n}`;

    const snippet = instantiateSnippet(template, url, type, pathstr);
    expect(snippet).toEqual(`{
  "url": "scheme://_:{{creds}}@url/path",
  "type": "pyfs",
  "path": "full/path/file.txt",
  "full_url": "scheme://_:{{creds}}@url/path/full/path/file.txt",
  "full_path": "drivename:/full/path/file.txt",
  "drive": "drivename",
  "protocol": "scheme",
  "resource": "url/path"
}`);
  });

  it("should handle root path", () => {
    const pathstr = "drivename";
    const url = "scheme://";
    const type =  "pyfs";

    const template = `{\n  ${knownArgs.map(arg => `"${arg}": "{{${arg}}}"`).join(",\n  ")}\n}`;

    const snippet = instantiateSnippet(template, url, type, pathstr);
    expect(snippet).toEqual(`{
  "url": "scheme://",
  "type": "pyfs",
  "path": "",
  "full_url": "scheme://",
  "full_path": "drivename:/",
  "drive": "drivename",
  "protocol": "scheme",
  "resource": ""
}`);
  });

});


class TestConnector extends StateDB {
  schemas: { [key: string]: ISettingRegistry.ISchema } = {
    "jupyter-fs": importedSchema as ISettingRegistry.ISchema,
  };

  async fetch(id: string): Promise<ISettingRegistry.IPlugin | undefined> {
    const fetched = await super.fetch(id);
    if (!fetched && !this.schemas[id]) {
      return undefined;
    }

    const schema = importedSchema as ISettingRegistry.ISchema;
    const composite = {};
    const user = {};
    const raw = (fetched as string) || "{ }";
    const version = "test";
    return { id, data: { composite, user }, raw, schema, version };
  }

  async list(): Promise<any> {
    return Promise.reject("list method not implemented");
  }
}


describe("getSettingsSnippets", () => {

  const connector = new TestConnector();
  const timeout = 500;
  let registry: SettingRegistry;


  afterEach(() => connector.clear());

  beforeEach(() => {
    registry = new SettingRegistry({ connector, timeout });
  });


  it("should return snippets with regexp instances", async () => {
    const settings = await registry.load("jupyter-fs");
    const snippets = getSettingsSnippets(settings);
    expect(snippets.map(s => s.label)).toEqual(importedSchema.properties.snippets.default.map(d => d.label));
    expect(snippets.map(s => s.caption)).toEqual(importedSchema.properties.snippets.default.map(d => d.caption));
    expect(snippets.map(s => s.template)).toEqual(importedSchema.properties.snippets.default.map(d => d.template));
    const patterns = snippets.map(s => s.pattern);
    for (const p of patterns) {
      expect(p).toBeInstanceOf(RegExp);
    }
  });


  it("should handle missing settings", () => {
    const snippets = getSettingsSnippets();
    expect(snippets).toEqual([]);
  });

});


describe("getServerSnippets", () => {


  it("should return snippets with regexp instances", async () => {
    const originalSnippets = importedSchema.properties.snippets.default;
    const settings = ServerConnection.makeSettings({
      fetch: async (input: RequestInfo, init?: RequestInit): Promise<Response> => new Response(JSON.stringify({ snippets: originalSnippets })),
    });
    const snippets = await getServerSnippets(settings);
    expect(snippets.map(s => s.label)).toEqual(importedSchema.properties.snippets.default.map(d => d.label));
    expect(snippets.map(s => s.caption)).toEqual(importedSchema.properties.snippets.default.map(d => d.caption));
    expect(snippets.map(s => s.template)).toEqual(importedSchema.properties.snippets.default.map(d => d.template));
    const patterns = snippets.map(s => s.pattern);
    for (const p of patterns) {
      expect(p).toBeInstanceOf(RegExp);
    }
  });


  it("should handle network errors", async () => {
    const settings = ServerConnection.makeSettings({
      fetch: async (input: RequestInfo, init?: RequestInit): Promise<Response> => new Response(null, { status: 500 }),
    });
    const snippetsPromise = getServerSnippets(settings);
    await expect(snippetsPromise).rejects.toBeInstanceOf(Response);
  });

});

describe("snippetFormRender", () => {

  it("should populate the uiSchema", () => {
    function mockField(props: any): any {
      // no-op
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const comp = snippetFormRender({
      registry: {
        fields: {
          ArrayField: mockField,
        },
      } as any,
      uiSchema: {},
    } as any);

    expect(comp.props.uiSchema).toEqual({
      items: {
        template: {
          "ui:widget": "textarea",
        },
      },
    });
  });

});
