/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

/* Based on code from JupyterLab, copied under the following license:

Copyright (c) 2015-2021 Project Jupyter Contributors
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

import { showErrorMessage, ToolbarButton  } from "@jupyterlab/apputils";
import { IChangedArgs } from "@jupyterlab/coreutils";
import { shouldOverwrite } from "@jupyterlab/docmanager";
import { Contents } from "@jupyterlab/services";
import {
  ITranslator,
  nullTranslator,
  TranslationBundle,
} from "@jupyterlab/translation";
import { fileUploadIcon } from "@jupyterlab/ui-components";
import { ArrayExt } from "@lumino/algorithm";
import { IDisposable } from "@lumino/disposable";
import { ISignal, Signal } from "@lumino/signaling";
import { Content, ContentsModel } from "@tree-finder/base";

import type { ContentsProxy } from "./contents_proxy";
import { getContentParent } from "./contents_utils";


/**
 * The size (in bytes) of the biggest chunk we should upload at once.
 */
export const CHUNK_SIZE = 1024 * 1024;

/**
 * An upload completed to `path`.
 */
export interface IUploadedData {
  path: string[];
}

/**
* An upload progress event for a file at `path`.
*/
export interface IUploadProgress {
  path: string;
  /**
  * % uploaded [0, 1)
  */
  progress: number;
}

export class UploadButton extends ToolbarButton {
  /**
   * Construct a new file browser buttons widget.
   */
  constructor(options: UploadButton.IOptions) {
    super({
      icon: fileUploadIcon,
      label: options.label,
      onClick: () => {
        this._input.click();
      },
      tooltip: Private.translateToolTip(options.translator),
    });
    this.translator = options.translator || nullTranslator;
    this._trans = this.translator.load("jupyterlab");
    this._uploader = options.uploader;
    this._input.onclick = this._onInputClicked;
    this._input.onchange = this._onInputChanged;
    this.addClass("jp-id-upload");
  }

  /**
   * The 'change' handler for the input field.
   */
  private _onInputChanged = () => {
    const files = Array.prototype.slice.call(this._input.files) as File[];
    const pending = files.map(async file => (await this._uploader).upload(file));
    void Promise.all(pending).catch(error => {
      void showErrorMessage(
        this._trans._p("showErrorMessage", "Upload Error"),
        error as string
      );
    });
  };

  /**
   * The 'click' handler for the input field.
   */
  private _onInputClicked = () => {
    // In order to allow repeated uploads of the same file (with delete in between),
    // we need to clear the input value to trigger a change event.
    this._input.value = "";
  };

  protected translator: ITranslator;
  private _trans: TranslationBundle;
  private _input = Private.createUploadInput();
  private _uploader: Promise<Uploader>;
}

export namespace UploadButton {
  export interface IOptions {
    /**
     * The language translator.
     */
    translator?: ITranslator;

    /**
     * An optional label.
     */
    label?: string;

    /**
     * Pormise to uploader instance to handle upload logic
     */
    uploader: Promise<Uploader>
  }
}

/**
 * A widget which provides an upload button.
 */
export class Uploader implements IDisposable {
  /**
   * Construct a new file browser buttons widget.
   */
  constructor(options: Uploader.IOptions) {
    this.model = options.model;
    this._contentsProxy = options.contentsProxy;
  }

  /**
   * A signal emitted when an upload progresses.
   */
  get uploadChanged(): ISignal<this, IChangedArgs<IUploadProgress | null>> {
    return this._uploadChanged;
  }

  /**
   * A signal emitted when an upload completes.
   */
  get uploadCompleted(): ISignal<this, IUploadedData> {
    return this._uploadCompleted;
  }

  /**
   * Is this instance disposed?
   */
  get isDisposed() {
    return this._disposed;
  }

  /**
   * Dispose of the resources held by the model.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._disposed = true;
    Signal.clearData(this);
  }

  /**
   * Upload a `File` object.
   *
   * @param file - The `File` object to upload.
   *
   * @returns A promise containing the new file contents model.
   */
  async upload(file: File, target?: Content<ContentsProxy.IJupyterContentRow>): Promise<ContentsProxy.IJupyterContentRow | null> {
    await this._uploadCheckDisposed();
    target = target || this.model.selectedLast || this.model.root;
    if (!target.hasChildren) {
      target = await getContentParent(target, this.model.root);
    }
    const path = target.pathstr ? target.pathstr + "/" + file.name : file.name;
    let res = null;
    try {
      // alternatively to try to get the file and check for 404, we can get the parent
      // and check if the file is in the list.
      res = await this._contentsProxy.get(path, { content: false });
    } catch (e) {
      // TODO: Check if e is a 404
    }
    if (res) {
      // drop drive when prompting:
      if (!await shouldOverwrite(path.slice(path.indexOf("/") + 1))) {
        return null;
      }
    }
    await this._uploadCheckDisposed();
    const chunkedUpload = file.size > CHUNK_SIZE;
    const uploaded = await this._upload(file, path, chunkedUpload);
    target.invalidate();
    this._uploadCompleted.emit({ path: uploaded.path });
    return uploaded;
  }

  /**
   * Perform the actual upload.
   */
  private async _upload(
    file: File,
    path: string,
    chunked: boolean
  ): Promise<ContentsProxy.IJupyterContentRow> {
    // Gather the file model parameters.
    const name = file.name;
    const type: Contents.ContentType = "file";
    const format: Contents.FileFormat = "base64";

    const uploadInner = async (
      blob: Blob,
      chunk?: number
    ): Promise<ContentsProxy.IJupyterContentRow> => {
      await this._uploadCheckDisposed();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      await new Promise((resolve, reject) => {
        reader.onload = resolve;
        reader.onerror = event =>
          reject(`Failed to upload "${file.name}":  ${event}`);
      });
      await this._uploadCheckDisposed();

      // remove header https://stackoverflow.com/a/24289420/907060
      const content = (reader.result as string).split(",")[1];

      const model: Partial<Contents.IModel> = {
        type,
        format,
        name,
        chunk,
        content,
      };
      return await this._contentsProxy.save(path, model);
    };

    if (!chunked) {
      try {
        return await uploadInner(file);
      } catch (err) {
        ArrayExt.removeFirstWhere(this._uploads, uploadIndex => file.name === uploadIndex.path);
        throw err;
      }
    }

    let finalModel: ContentsProxy.IJupyterContentRow | undefined;

    let upload = { path, progress: 0 };
    this._uploadChanged.emit({
      name: "start",
      newValue: upload,
      oldValue: null,
    });

    for (let start = 0; !finalModel; start += CHUNK_SIZE) {
      const end = start + CHUNK_SIZE;
      const lastChunk = end >= file.size;
      const chunk = lastChunk ? -1 : end / CHUNK_SIZE;

      const newUpload = { path, progress: start / file.size };
      this._uploads.splice(this._uploads.indexOf(upload));
      this._uploads.push(newUpload);
      this._uploadChanged.emit({
        name: "update",
        newValue: newUpload,
        oldValue: upload,
      });
      upload = newUpload;

      let currentModel: ContentsProxy.IJupyterContentRow;
      try {
        currentModel = await uploadInner(file.slice(start, end), chunk);
      } catch (err) {
        ArrayExt.removeFirstWhere(this._uploads, uploadIndex => file.name === uploadIndex.path);

        this._uploadChanged.emit({
          name: "failure",
          newValue: upload,
          oldValue: null,
        });

        throw err;
      }

      if (lastChunk) {
        finalModel = currentModel;
      }
    }

    this._uploads.splice(this._uploads.indexOf(upload));
    this._uploadChanged.emit({
      name: "finish",
      newValue: null,
      oldValue: upload,
    });

    return finalModel;
  }

  private _uploadCheckDisposed(): Promise<void> {
    if (this.isDisposed) {
      return Promise.reject("Filemanager disposed. File upload canceled");
    }
    return Promise.resolve();
  }


  model: ContentsModel<ContentsProxy.IJupyterContentRow>;
  private _contentsProxy: ContentsProxy;
  private _uploads: IUploadProgress[] = [];
  private _uploadChanged = new Signal<this, IChangedArgs<IUploadProgress | null>>(
    this
  );
  private _uploadCompleted = new Signal<this, IUploadedData>(
    this
  );
  private _disposed = false;
}


/**
 * The namespace for Uploader class statics.
 */
export namespace Uploader {
  /**
   * The options used to create an uploader.
   */
  export interface IOptions {

    /**
     * Contents model
     */
    model: ContentsModel<ContentsProxy.IJupyterContentRow>;

    /**
     * Contents manager proxy
     */
    contentsProxy: ContentsProxy;
  }
}

/**
 * The namespace for module private data.
 */
namespace Private {
  /**
   * Create the upload input node for a file buttons widget.
   */
  export function createUploadInput(): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    return input;
  }

  /**
   * Translate upload tooltip.
   */
  export function translateToolTip(translator?: ITranslator): string {
    translator = translator || nullTranslator;
    const trans = translator.load("jupyterlab");
    return trans.__("Upload Files");
  }
}
