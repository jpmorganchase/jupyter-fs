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
    this.clipboardModel.pasteSub.subscribe(async ({destination, doCut, memo}) => {
      const destPathstr = Path.fromarray(destination.kind === "dir" ? destination.path : destination.path.slice(-1));
      const srcPathstrs = memo.map(src => Path.fromarray(src.path));

      for (const srcPathstr of srcPathstrs) {
        if (doCut) {
          await this.destDrive.copy(srcPathstr, destPathstr);
          this.srcDrive.delete(srcPathstr);
        } else {
          this.destDrive.copy(srcPathstr, destPathstr);
        }
      }
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

  pasteSelection<T extends IContentRow>(contentsModel: ContentsModel<T>, drive: Contents.IDrive) {
    this.destDrive = drive;
    this.clipboardModel.pasteSelection(contentsModel);
  }

  protected clipboardModel = new ClipboardModel();
  protected srcDrive: Contents.IDrive | null = null;
  protected destDrive: Contents.IDrive | null = null;
}

export namespace JupyterClipboard {
  export const defaultClipboard = new JupyterClipboard();
}
