/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */
import { WidgetTracker, showErrorMessage } from "@jupyterlab/apputils";
import { Drive } from "@jupyterlab/services";
import { ClipboardModel, ContentsModel, IContentRow, Path } from "tree-finder";

import type { ContentsProxy } from "./contents_proxy";
import type { TreeFinderSidebar } from "./treefinder";
import { getRefreshTargets } from "./contents_utils";

export class JupyterClipboard {
  constructor(tracker: WidgetTracker<TreeFinderSidebar>) {
    this._tracker = tracker;

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this._model.deleteSub.subscribe(async memo => {
      await Promise.all(memo.map(s => this._onDelete(s)));
      const contentsModel = this._tracker.currentWidget!.treefinder.model!;
      const toRefresh = getRefreshTargets<ContentsProxy.IJupyterContentRow>(
        memo as ContentsProxy.IJupyterContentRow[],
        contentsModel.root,
        true
      );
      this.model.refresh(contentsModel, toRefresh!);
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this._model.pasteSub.subscribe(async ({ destination, doCut, memo }) => {
      const destPath = destination.kind === "dir" ? destination.path : destination.path.slice(0, -1);
      const destPathstr = Path.fromarray(destPath);
      await Promise.all(memo.map(s => this._onPaste(s, destPathstr, doCut)));
      const contentsModel = this._tracker.currentWidget!.treefinder.model!;
      let toRefresh = getRefreshTargets<ContentsProxy.IJupyterContentRow>(
        [destination] as ContentsProxy.IJupyterContentRow[],
        contentsModel.root,
        false
      );
      // Only refresh sources if cutting:
      if (doCut && toRefresh !== undefined) {
        const extra = getRefreshTargets<ContentsProxy.IJupyterContentRow>(
          memo as ContentsProxy.IJupyterContentRow[],
          contentsModel.root,
          false
        );
        if (extra === undefined) {
          toRefresh = undefined;
        } else {
          toRefresh.push(...extra);
        }
      }
      this.model.refresh(contentsModel, toRefresh!);
    });
  }

  refresh<T extends IContentRow>(tm?: ContentsModel<T>, memo?: T[]) {
    tm ??= this._tracker.currentWidget!.treefinder.model as any as ContentsModel<T>;
    this.model.refresh(tm, memo!);
  }

  // TODO: remove in favor of this.model.refreshSelection once tree-finder v0.0.14 is out
  refreshSelection<T extends IContentRow>(tm: ContentsModel<T>) {
    this.refresh(tm, tm.selection.map(x => x.row));
  }

  get model() {
    return this._model;
  }

  protected async _onDelete<T extends IContentRow>(src: T) {
    const srcPathstr = Path.fromarray(src.path);
    try {
      await this._drive.delete(srcPathstr);
    } catch (err) {
      await showErrorMessage("Delete Failed", err as string);
    }
  }

  protected async _onPaste<T extends IContentRow>(src: T, destPathstr: string, doCut: boolean) {
    const srcPathstr = Path.fromarray(src.path);
    try {
      await this._drive.copy(srcPathstr, destPathstr);
      if (doCut) {
        await this._drive.delete(srcPathstr);
      }
    } catch (err) {
      await showErrorMessage("Paste Error", err as string);
    }
  }

  protected _model = new ClipboardModel();
  protected _tracker: WidgetTracker<TreeFinderSidebar>;

  private _drive = new Drive();
}
