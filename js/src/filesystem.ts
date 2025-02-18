/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import { URLExt } from "@jupyterlab/coreutils";
import { ServerConnection } from "@jupyterlab/services";

export interface IFSOptions {
  _addServerside?: boolean;

  /**
   * If true, only recreate the actual resource when necessary
   */
  cache?: boolean;

  /**
   * If true, enable jupyter-fs debug output in both frontend and backend
   */
  verbose?: boolean;

  /**
   * The version of the package that these settings were written with
   */
  writtenVersion?: string;
}


/**
 * A resource configuration as stored in the settings system.
 */
export interface IFSSettingsResource {
  /**
   * The name of this resource
   */
  name?: string;

  /**
   * The fsurl specifying this resource
   */
  url?: string;

  /**
   * Auth scheme to be used for this resource, or none
   */
  auth: "ask" | "env" | "none";

  /**
   * Backend type
   */
  type: "pyfs" | "fsspec";

  /**
   * Fallback for determining if resource is writeable. Used only if the underlying PyFilesystem does not provide this information (eg S3)
   */
  defaultWritable?: boolean;

  /**
   * Directory to be first opened
   */
  preferredDir?: string;

  /**
   * Generic arguments to pass through to instantiation, for elements
   * that cannot be placed in the resource url. Represented as JSON
   */
  kwargs?: JSON;
}


/**
 * An object defining an FS resource.
 */
export interface IFSResource extends IFSSettingsResource {
  /**
   * The name of this resource
   */
  name: string;

  /**
   * The fsurl specifying this resource
   */
  url: string;

  /**
   * The jupyterlab drive name associated with this resource. This is defined
   * on resource initialization
   */
  drive?: string;

  /**
   * `true` if resource has been initialized
   */
  init?: boolean;

  /**
   * If present, a list of "{{token}}" template parameters that were missing
   * from the tokenDict on the most recent attempt to initialize this resource
   */
  missingTokens?: string[];

  /**
   * If present, a dict of [token, value] pairs that will be substituted
   * for any "{{token}}" template parameters present in the url on resource
   * initialization
   */
  tokenDict?: {[key: string]: string};

  /**
   * Any errors during initialization
   */
  errors?: string[];

}

export interface IFSComm {
  /**
   * Send a parameterized GET request to the `/jupyterfs/resources` api, and
   * return the result.
   */
  getResourcesRequest: () => Promise<IFSResource[]>;

  /**
   * Send a parameterized POST request to the `/jupyterfs/resources` api, and
   * return the result.
   */
  initResourceRequest: (args: {options: IFSOptions; resources: IFSResource[]}) => Promise<IFSResource[]>;

  /**
   * The base url to prefix onto the uri of this Comm's requests
   */
  baseUrl: string;
}

abstract class FSCommBase implements IFSComm {
  protected _settings: ServerConnection.ISettings | undefined = undefined;

  abstract getResourcesRequest(): Promise<IFSResource[]>;
  abstract initResourceRequest(args: {options: IFSOptions; resources: IFSResource[]}): Promise<IFSResource[]>;

  get baseUrl(): string {
    return this.settings.baseUrl;
  }

  get resourcesUrl(): string {
    return URLExt.join(this.baseUrl, "jupyterfs/resources");
  }

  get settings(): ServerConnection.ISettings {
    if (!this._settings) {
      this._settings = ServerConnection.makeSettings();
    }

    return this._settings;
  }
}

export class FSComm extends FSCommBase {

  private static _instance: FSComm;

  static get instance(): FSComm {
    if (FSComm._instance === undefined) {
      FSComm._instance = new FSComm();
    }
    return FSComm._instance;
  }

  async getResourcesRequest(): Promise<IFSResource[]> {
    const settings = this.settings;
    const fullUrl = this.resourcesUrl;

    return ServerConnection.makeRequest(
      fullUrl,
      { method: "GET" },
      settings
    ).then(response => {
      if (response.status !== 200) {
        return response.text().then(data => {
          throw new ServerConnection.ResponseError(response, data);
        });
      }

      return response.json();
    });
  }

  async initResourceRequest(args: {options: IFSOptions; resources: IFSResource[]}): Promise<IFSResource[]> {
    const settings = this.settings;
    const fullUrl = this.resourcesUrl;

    return ServerConnection.makeRequest(
      fullUrl,
      {
        body: JSON.stringify(args),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
      settings
    ).then(response => {
      if (response.status !== 200) {
        return response.text().then(data => {
          throw new ServerConnection.ResponseError(response, data);
        });
      }
      return response.json();
    });
  }
}
