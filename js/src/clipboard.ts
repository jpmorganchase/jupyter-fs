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
import { Widget } from "@lumino/widgets";
import { ClipboardModel, ContentsModel, IContentRow, Path } from "tree-finder";

// "forward" declare the TreeFinderWidget
type ITreeFinderWidget = Widget & {treefinder: {model: ContentsModel<any>}};

export class JupyterClipboard {
  constructor(tracker: WidgetTracker<ITreeFinderWidget>) {
    this._tracker = tracker;

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this._model.deleteSub.subscribe(async memo => {
      await Promise.all(memo.map(s => this._onDelete(s)));
      const rootNeedsRefresh = memo.some(v => v.path.length <= 2);
      // tree-finder doesn't correctly refresh parents of folders, so we work around it for now
      // (in more detail, tree-finder will only refresh the folder if the entry does not have a
      // getChildren entry, go figure...)
      this.model.refresh(
        this._tracker.currentWidget.treefinder.model,
        rootNeedsRefresh ? undefined : memo.map(s => { return {...s, getChildren: undefined}})
      );
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this._model.pasteSub.subscribe(async ({ destination, doCut, memo }) => {
      const destPath = destination.kind === "dir" ? destination.path : destination.path.slice(0, -1);
      const destPathstr = Path.fromarray(destPath);
      const rootNeedsRefresh = destPath.length <= 1;
      await Promise.all(memo.map(s => this._onPaste(s, destPathstr, doCut)));
      const to_invalidate = rootNeedsRefresh ?
        undefined :
        [destination, ...(doCut ? memo : [])]  // only invalidate sources if cutting
      this.model.refresh(this._tracker.currentWidget.treefinder.model, to_invalidate);
    });
  }

  refresh<T extends IContentRow>(tm?: ContentsModel<T>, memo?: T[]) {
    tm ??= this._tracker.currentWidget.treefinder.model as any as ContentsModel<T>;
    this.model.refresh(tm, memo);
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
      showErrorMessage('Delete Failed', err);
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
      showErrorMessage('Paste Error', err);
    }
  }

  protected _model = new ClipboardModel();
  protected _tracker: WidgetTracker<ITreeFinderWidget>;

  private _drive = new Drive();
}
