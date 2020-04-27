/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */
import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';

// tslint:disable: no-namespace
// tslint:disable: variable-name
// tslint:disable: max-line-length
// tslint:disable: max-classes-per-file

export interface IFSResource {
  name: string;
  desc: string;
  fsurl: string;
}

export interface IFSResourceInited extends IFSResource {
  drive: string;
}

export interface IFSComm {
  /**
   * Send a parameterized GET request to the `/jupyterfs/resources` api, and
   * return the result.
   */
  getResourcesRequest: () => Promise<IFSResourceInited[]>;

  /**
   * Send a parameterized POST request to the `/jupyterfs/resources` api, and
   * return the result.
   */
  setResourcesRequest: (param: IFSResource) => Promise<IFSResourceInited[]>;

  /**
   * The base url to prefix onto the uri of this Comm's requests
   */
  baseUrl: string;
}

abstract class FSCommBase implements IFSComm {
  constructor(props: { baseUrl?: string } = {}) {
    const { baseUrl } = props;

    if (baseUrl) {
      this.baseUrl = baseUrl;
    }
  }

  abstract async getResourcesRequest(): Promise<IFSResourceInited[]>;
  abstract async setResourcesRequest(...resource: IFSResource[]): Promise<IFSResourceInited[]>;

  get baseUrl(): string {
    return this.settings.baseUrl;
  }
  set baseUrl(baseUrl: string) {
    if (baseUrl !== this.baseUrl) {
      this._settings = ServerConnection.makeSettings({ baseUrl });
    }
  }

  get resourcesUrl(): string {
    return URLExt.join(this.baseUrl, 'resources');
  }

  get settings(): ServerConnection.ISettings {
    if (!this._settings) {
      this._settings = ServerConnection.makeSettings();
    }

    return this._settings;
  }

  protected _settings: ServerConnection.ISettings | undefined = undefined;
}

export class FSComm extends FSCommBase {
  async getResourcesRequest(): Promise<IFSResourceInited[]> {
    const settings = this.settings;
    const fullUrl = this.resourcesUrl;

    return ServerConnection.makeRequest(
      fullUrl,
      { method: 'GET' },
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

  async setResourcesRequest(...resource: IFSResource[]): Promise<IFSResourceInited[]> {
    const settings = this.settings;
    const fullUrl = this.resourcesUrl;

    return ServerConnection.makeRequest(
      fullUrl,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(resource),
        method: 'POST'
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
