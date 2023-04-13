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

import { VDomModel, VDomRenderer, WidgetTracker } from "@jupyterlab/apputils";
import { IChangedArgs } from "@jupyterlab/coreutils";
import { GroupItem, ProgressBar, TextItem } from "@jupyterlab/statusbar";
import {
  ITranslator,
  nullTranslator,
} from "@jupyterlab/translation";
import { ArrayExt } from "@lumino/algorithm";
import React from "react";

import type { TreeFinderSidebar } from "./treefinder";
import type { IUploadProgress, Uploader } from "./upload";

/**
 * Half-spacing between items in the overall status item.
 */
const HALF_SPACING = 4;

/**
 * A pure function component for a FileUpload status item.
 *
 * @param props: the props for the component.
 *
 * @returns a tsx component for the file upload status.
 */
function FileUploadComponent(
  props: FileUploadComponent.IProps
): React.ReactElement<FileUploadComponent.IProps> {
  const translator = props.translator || nullTranslator;
  const trans = translator.load("jupyterlab");
  const items = [<TextItem source={trans.__("Uploading…")} />];
  items.push(...props.items.map(
    i => i.complete ?
      <TextItem source={trans.__("Complete!")} /> :
      <ProgressBar percentage={i.progress}/>
  ));
  return (
    <GroupItem spacing={HALF_SPACING}>
      {...items}
    </GroupItem>
  );
}

/**
 * A namespace for FileUploadComponent statics.
 */
namespace FileUploadComponent {
  /**
   * The props for the FileUploadComponent.
   */
  export interface IProps {
    /**
     * The current upload percentage, from 0 to 100.
     */
    items: IFileUploadItem[];

    /**
     * The language translator.
     */
    translator?: ITranslator;
  }
}

/**
 * The time for which to show the "Complete!" message after uploading.
 */
const UPLOAD_COMPLETE_MESSAGE_MILLIS = 2000;

/**
 * Status bar item to display file upload progress.
 */
export class FileUploadStatus extends VDomRenderer<FileUploadStatus.Model> {
  /**
   * Construct a new FileUpload status item.
   */
  constructor(opts: FileUploadStatus.IOptions) {
    super(
      new FileUploadStatus.Model(opts.tracker.currentWidget)
    );
    this.translator = opts.translator || nullTranslator;
    this._tracker = opts.tracker;
    this._tracker.currentChanged.connect(this._onTreeFinderChange);
  }

  /**
   * Render the FileUpload status.
   */
  render() {
    const items = this.model.items;
    if (items.length > 0) {
      return (
        <FileUploadComponent
          items={this.model.items}
          translator={this.translator}
        />
      );
    } else {
      return <></>;
    }
  }

  dispose() {
    super.dispose();
    this._tracker.currentChanged.disconnect(this._onTreeFinderChange);
  }

  private _onTreeFinderChange = (
    tracker: WidgetTracker<TreeFinderSidebar>,
    sidebar: TreeFinderSidebar | null
  ) => {
    if (sidebar === null) {
      this.model.sidebar = null;
    } else {
      this.model.sidebar = sidebar;
    }
  };

  private readonly translator: ITranslator;
  private _tracker: WidgetTracker<TreeFinderSidebar>;
}

/**
 * A namespace for FileUpload class statics.
 */
export namespace FileUploadStatus {
  /**
   * The VDomModel for the FileUpload renderer.
   */
  export class Model extends VDomModel {
    /**
     * Construct a new model.
     */
    constructor(sidebar: TreeFinderSidebar | null) {
      super();
      this.sidebar = sidebar;
    }

    /**
     * The currently uploading items.
     */
    get items() {
      return this._items;
    }

    /**
     * The current file browser model.
     */
    get sidebar(): TreeFinderSidebar | null {
      return this._sidebar;
    }
    set sidebar(browserModel: TreeFinderSidebar | null) {
      const oldSidebar = this._sidebar;
      if (oldSidebar) {
        oldSidebar.treefinder.uploader!.uploadChanged.disconnect(this._uploadChanged);
      }

      this._sidebar = browserModel;
      this._items = [];

      if (this._sidebar !== null) {
        this._sidebar.treefinder.uploader!.uploadChanged.connect(this._uploadChanged);
      }

      this.stateChanged.emit(void 0);
    }

    /**
     * Handle an uploadChanged event in the filebrowser model.
     */
    private _uploadChanged = (
      uploader: Uploader,
      uploads: IChangedArgs<IUploadProgress>
    ) => {
      if (uploads.name === "start") {
        this._items.push({
          path: uploads.newValue.path,
          progress: uploads.newValue.progress * 100,
          complete: false,
        });
      } else if (uploads.name === "update") {
        const idx = ArrayExt.findFirstIndex(
          this._items,
          val => val.path === uploads.oldValue.path
        );
        if (idx !== -1) {
          this._items[idx].progress = uploads.newValue.progress * 100;
        }
      } else if (uploads.name === "finish") {
        const finishedItem = ArrayExt.findFirstValue(
          this._items,
          val => val.path === uploads.oldValue.path
        );

        if (finishedItem) {
          finishedItem.complete = true;
          setTimeout(() => {
            ArrayExt.removeFirstOf(this._items, finishedItem);
            this.stateChanged.emit(void 0);
          }, UPLOAD_COMPLETE_MESSAGE_MILLIS);
        }
      } else if (uploads.name === "failure") {
        ArrayExt.removeFirstWhere(
          this._items,
          val => val.path === uploads.newValue.path
        );
      }

      this.stateChanged.emit(void 0);
    };

    private _items: IFileUploadItem[] = [];
    private _sidebar: TreeFinderSidebar | null = null;
  }

  /**
   * Options for creating the upload status item.
   */
  export interface IOptions {
    /**
     * The application file browser tracker.
     */
    readonly tracker: WidgetTracker<TreeFinderSidebar>;

    /**
     * The translation language bundle.
     */
    readonly translator?: ITranslator;
  }
}

/**
 * The interface for an item that is being uploaded to
 * the file system.
 */
interface IFileUploadItem {
  /**
   * The path on the filesystem that is being uploaded to.
   */
  path: string;

  /**
   * The upload progress fraction.
   */
  progress: number;

  /**
   * Whether the upload is complete.
   */
  complete: boolean;
}
