/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */
import { Contents } from "@jupyterlab/services";

import { ClipboardModel, ContentsModel, IContentRow, Path } from "tree-finder";

export class JupyterClipboard {
  constructor() {
    this.clipboardModel.deleteSub.subscribe(memo => {
      Promise.all(memo.map(s => this._onDelete(s)));
    });

    this.clipboardModel.pasteSub.subscribe(({ destination, doCut, memo }) => {
      const destPathstr = Path.fromarray(destination.kind === "dir" ? destination.path : destination.path.slice(0, -1));
      Promise.all(memo.map(s => this._onPaste(s, destPathstr, doCut)));
    });
  }

  copySelection<T extends IContentRow>(contentsModel: ContentsModel<T>, drive: Contents.IDrive) {
    this.srcDrive = drive;
    this.clipboardModel.copySelection(contentsModel);
  }

  cutSelection<T extends IContentRow>(contentsModel: ContentsModel<T>, drive: Contents.IDrive) {
    this.srcDrive = drive;
    this.clipboardModel.cutSelection(contentsModel);
  }

  deleteSelection<T extends IContentRow>(contentsModel: ContentsModel<T>, drive: Contents.IDrive) {
    this.srcDrive = drive;
    this.clipboardModel.deleteSelection(contentsModel);
  }

  pasteSelection<T extends IContentRow>(contentsModel: ContentsModel<T>, drive: Contents.IDrive) {
    this.destDrive = drive;
    this.clipboardModel.pasteSelection(contentsModel);
  }

  protected async _onDelete<T extends IContentRow>(src: T) {
    const srcPathstr = Path.fromarray(src.path);
    await this.srcDrive.delete(srcPathstr);
  }

  protected async _onPaste<T extends IContentRow>(src: T, destPathstr: string, doCut: boolean) {
    const srcPathstr = Path.fromarray(src.path);
    await this.destDrive.copy(srcPathstr, destPathstr);
    if (doCut) {
      await this.srcDrive.delete(srcPathstr);
    }
  }

  protected clipboardModel = new ClipboardModel();
  protected srcDrive: Contents.IDrive | null = null;
  protected destDrive: Contents.IDrive | null = null;
}

export namespace JupyterClipboard {
  export const defaultClipboard = new JupyterClipboard();
}
