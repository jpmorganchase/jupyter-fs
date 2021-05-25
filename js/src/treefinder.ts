/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */
import { ILayoutRestorer, IRouter, JupyterFrontEnd } from "@jupyterlab/application";
import { WidgetTracker /*Clipboard, Dialog, IWindowResolver, showDialog, showErrorMessage, Toolbar, ToolbarButton*/ } from "@jupyterlab/apputils";
import { IWindowResolver /*Toolbar*/ } from "@jupyterlab/apputils";
// import { PathExt, URLExt } from "@jupyterlab/coreutils";
// import { IDocumentManager, isValidFileName, renameFile } from "@jupyterlab/docmanager";
import { IDocumentManager } from "@jupyterlab/docmanager";
// import { DocumentRegistry } from "@jupyterlab/docregistry";
import { Contents, ContentsManager, Drive } from "@jupyterlab/services";
import {
  closeIcon,
  copyIcon,
  cutIcon,
  pasteIcon,
} from "@jupyterlab/ui-components";
// import JSZip from "jszip";
import { DisposableSet, IDisposable } from "@lumino/disposable";
import { Widget /*PanelLayout*/ } from "@lumino/widgets";
import { Format, IContentRow, Path, TreeFinderPanelElement } from "tree-finder";

import { JupyterClipboard } from "./clipboard";
import { IFSResource } from "./filesystem";
import { fileTreeIcon } from "./icons";
// import { Uploader } from "./upload";

export class JupyterContents {
  constructor(cm: ContentsManager, drive?: string) {
    this.cm = cm;
    this.drive = drive;
  }

  async get(path: string) {
    path = JupyterContents.toFullPath(path, this.drive);
    return JupyterContents.toJupyterContentRow(await this.cm.get(path), this.cm, this.drive);
  }

  readonly cm: ContentsManager;
  readonly drive: string;
}

export namespace JupyterContents {
  export interface IJupyterContentRow extends Omit<Contents.IModel, "path" | "content" | "type">, IContentRow {}

  export function toFullPath(path: string, drive?: string): string {
    return (!drive || path.startsWith(`${drive}:`)) ? path : [drive, path].join(":");
  }

  export function toLocalPath(path: string): string {
    const [first, ...rest] = path.split("/");
    return [first.split(":").pop(), ...rest].join("/");
  }

  export function toJupyterContentRow(row: Contents.IModel, cm: ContentsManager, drive: string): IJupyterContentRow {
    const { path, type, ...rest } = row;

    const pathWithDrive = toFullPath(path, drive);
    const kind = type === "directory" ? "dir" : type;

    return {
      path: Path.toarray(pathWithDrive),
      kind,
      ...rest,
      ...(kind === "dir" ? {
        getChildren: async () => (await cm.get(pathWithDrive, { content: true })).content.map((c: Contents.IModel) => toJupyterContentRow(c, cm, drive)),
      }: {}),
    };
  }
}

export class TreeFinderTracker extends WidgetTracker<TreeFinder> {
  async add(finder: TreeFinder) {
    super.add(finder);

    this._finders.set(finder.id, finder);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    finder.disposed.connect(this._onWidgetDisposed, this);
  }

  remove(finder: TreeFinder) {
    this._finders.delete(finder.id);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    finder.disposed.disconnect(this._onWidgetDisposed, this);
  }

  findByDrive(drive: string) {
    return this._finders.get(drive);
  }

  hasByDrive(drive: string) {
    return this._finders.has(drive);
  }

  private _onWidgetDisposed(finder: TreeFinder) {
    this.remove(finder);
  }

  private _finders = new Map<string, TreeFinder>();
}

export class TreeFinder extends Widget {
  constructor({
    app,
    rootPath = "",
    caption = "TreeFinder",
    id = "jupyterlab-tree-finder",
  }: TreeFinder.IOptions) {
    const { commands, serviceManager: { contents } } = app;

    const node = document.createElement<JupyterContents.IJupyterContentRow>("tree-finder-panel");
    super({ node });
    this.id = id;
    this.title.icon = fileTreeIcon;
    this.title.caption = caption;
    this.title.closable = true;
    this.addClass("jp-tree-finder");
    this.addClass(id);

    this.cm = new JupyterContents(contents, rootPath);
    // each separate widget gets its own unique commands, with each commandId prefixed with the widget's unique id
    // TODO: check on edge cases where two widget's share id (ie when two widgets are both views onto the same ContentsManager on the backend)
    this.commandIds = Object.fromEntries(TreeFinder.commandNames.map(name => [name, `${this.id}:treefinder:${name}`])) as TreeFinder.ICommandIds;

    // this.dr = app.docRegistry;

    // this.toolbar = new Toolbar<Widget>();
    // this.toolbar.addClass("tree-finder-toolbar");
    // this.toolbar.addClass(id);

    // const layout = new PanelLayout();
    // layout.addWidget(this.toolbar);
    // this.layout = layout;

    rootPath = rootPath === "" ? rootPath : rootPath + ":";
    this.cm.get(rootPath).then(root => {
      this.node.init({
        root,
        gridOptions: {
          columnFormatters: {
            last_modified: (x => Format.timeSince(x as any as Date)),
            size: (x => Format.bytesToHumanReadable(x)),
          },
          doWindowResize: true,
          showFilter: true,
        },
        modelOptions: {
          columnNames: ["size", "mimetype", "last_modified"],
        },
      });
    }).then(() => {
      this.model.openSub.subscribe(x => {
        if (x.kind !== "dir") {
          commands.execute("docmanager:open", { path: Path.fromarray(x.path) });
        }
      });
    });
  }

  reload() { // rebuild tree
    // this.table.removeChild(this.tree);
    // const tbody = this.table.createTBody();
    // tbody.id = "filetree-body";
    // this.tree = tbody;
    // const base = this.cm.get(this.basepath);
    // base.then(res => {
    //   this.buildTableContents(res.content, 1, "");
    // });
    // this.table.appendChild(tbody);
  }

  restore() { // restore expansion prior to rebuild
    // const array: Array<Promise<any>> = [];
    // Object.keys(this.controller).forEach(key => {
    //   if (this.controller[key].open && (key !== "")) {
    //     const promise = this.cm.get(this.basepath + key);
    //     promise.catch(res => {
    //       // eslint-disable-next-line no-console
    //       console.log(res);
    //     });
    //     array.push(promise);
    //   }
    // });
    // Promise.all(array).then(results => {
    //   for (const r in results) {
    //     const row_element = this.node.querySelector("[id='" + u_btoa(results[r].path.replace(this.basepath, "")) + "']");
    //     this.buildTableContents(results[r].content, 1 + results[r].path.split("/").length, row_element);
    //   }
    // }).catch(reasons => {
    //   // eslint-disable-next-line no-console
    //   console.log(reasons);
    // });
  }

  refresh() {
    this.reload();
    this.restore();
  }

  // async download(path: string, folder: boolean): Promise<any> {
  //   if (folder) {
  //     const zip = new JSZip();
  //     await this.wrapFolder(zip, path); // folder packing
  //     // generate and save zip, reset path
  //     path = PathExt.basename(path);
  //     writeZipFile(zip, path);
  //   } else {
  //     return this.cm.getDownloadUrl(this.basepath + path).then(url => {
  //       const element = document.createElement("a");
  //       document.body.appendChild(element);
  //       element.setAttribute("href", url);
  //       element.setAttribute("download", "");
  //       element.click();
  //       document.body.removeChild(element);
  //       return void 0;
  //     });
  //   }
  // }

  // async wrapFolder(zip: JSZip, path: string) {
  //   const base = this.cm.get(this.basepath + path);
  //   const next = base.then(async res => {
  //     if (res.type === "directory") {
  //       const new_folder = zip.folder(res.name);
  //       for (const c in res.content) {
  //         await this.wrapFolder(new_folder, res.content[c].path);
  //       }
  //     } else {
  //       zip.file(res.name, res.content);
  //     }
  //   });
  //   await next;
  // }

  protected onBeforeShow(msg: any): void {
    this.node.draw();
  }

  protected onResize(msg: any): void {
    this.node.draw();
  }

  get model() {
    return this.node.model;
  }

  get selection() {
    return this.node.model.selection;
  }

  get selectionPathstrs() {
    return this.node.model.selection.map(c => Path.fromarray(c.row.path));
  }

  cm: JupyterContents;
  // dr: DocumentRegistry;
  // toolbar: Toolbar;
  table: HTMLTableElement;
  tree: HTMLElement;

  readonly commandIds: TreeFinder.ICommandIds;
  readonly node: TreeFinderPanelElement<JupyterContents.IJupyterContentRow>;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace TreeFinder {
  const drive = new Drive();
  const namespace = "jupyter-fs:TreeFinder";

  // define the command ids as a constant tuple
  export const commandNames = [
    "copy",
    "cut",
    "delete",
    "open",
    "paste",
    "rename",
  ] as const;
  // use typescript-fu to convert commandIds to an interface
  export type ICommandIds = {[k in typeof commandNames[number]]: string};

  export interface IOptions {
    app: JupyterFrontEnd;

    rootPath?: string;
    caption?: string;
    id?: string;
  }

  export interface ISidebarProps extends IOptions {
    manager: IDocumentManager;
    paths: JupyterFrontEnd.IPaths;
    resolver: IWindowResolver;
    restorer: ILayoutRestorer;
    router: IRouter;

    side?: string;
  }

  export function sidebarFromResource(resource: IFSResource, props: TreeFinder.ISidebarProps): IDisposable {
    return sidebar({
      ...props,
      rootPath: resource.drive,
      caption: `${resource.name}\nFile Tree`,
      id: [resource.name.split(" ").join(""), resource.drive].join("_"),
    });
  }

  export function sidebar({
    app,
    manager,
    paths,
    resolver,
    restorer,
    router,

    rootPath = "",
    caption = "TreeFinder",
    id = "jupyterlab-tree-finder",
    side = "left",
  }: TreeFinder.ISidebarProps): IDisposable {
    // // TODO: ugly as sin. Consider other ways to get/construct drive
    // const drive = (app.serviceManager.contents as any as (Omit<ContentsManager, '_defaultDrive'> & {_defaultDrive: Contents.IDrive}))._defaultDrive;
    const selector = `#${id}`;
    const tracker = new TreeFinderTracker({ namespace });
    const widget = new TreeFinder({ app, rootPath, caption, id });
    tracker.add(widget);
    restorer.add(widget, widget.id);
    app.shell.add(widget, side);

    // const uploader_button = new Uploader({ manager, widget });
    // const new_file_button = new ToolbarButton({
    //   icon: newFolderIcon,
    //   onClick: () => {
    //     app.commands.execute((CommandIDs.create_folder + ":" + widget.id), { path: "" });
    //   },
    //   tooltip: "New Folder",
    // });
    // const refresh_button = new ToolbarButton({
    //   icon: refreshIcon,
    //   onClick: () => {
    //     app.commands.execute((CommandIDs.refresh + ":" + widget.id));
    //   },
    //   tooltip: "Refresh",
    // });

    // widget.toolbar.addItem("upload", uploader_button);
    // widget.toolbar.addItem("new file", new_file_button);
    // widget.toolbar.addItem("refresh", refresh_button);

    // // remove context highlight on context menu exit
    // document.ondblclick = () => {
    //   app.commands.execute((CommandIDs.set_context + ":" + widget.id), { path: "" });
    // };
    // widget.node.onclick = event => {
    //   app.commands.execute((CommandIDs.select + ":" + widget.id), { path: "" });
    // };

    // setInterval(() => {
    //   app.commands.execute(CommandIDs.refresh);
    // }, 10000);

    // return a disposable containing all disposables associated
    // with this widget, ending with the widget itself
    return [
      // globally accessible jupyter commands
      app.commands.addCommand(widget.commandIds.copy, {
        execute: args => {
          JupyterClipboard.defaultClipboard.copySelection(widget.model, drive);
        },
        icon: copyIcon,
        label: "Copy",
      }),
      app.commands.addCommand(widget.commandIds.cut, {
        execute: args => {
          JupyterClipboard.defaultClipboard.cutSelection(widget.model, drive);
        },
        icon: cutIcon,
        label: "Cut",
      }),
      app.commands.addCommand(widget.commandIds.delete, {
        execute: args => {
          JupyterClipboard.defaultClipboard.deleteSelection(widget.model, drive);
        },
        icon: closeIcon.bindprops({ stylesheet: "menuItem" }),
        label: "Delete",
      }),
      app.commands.addCommand(widget.commandIds.open, {
        execute: args => {
          for (const row of widget.selection.map(c => c.row)) {
            widget.model.openSub.next(row);
          }
        },
        label: "Open",
        // mnemonic: 0
      }),
      app.commands.addCommand(widget.commandIds.paste, {
        execute: args => {
          JupyterClipboard.defaultClipboard.pasteSelection(widget.model, drive);
        },
        icon: pasteIcon,
        label: "Paste",
      }),

      // context menu items
      app.contextMenu.addItem({
        command: widget.commandIds.open,
        selector,
        rank: 1,
      }),

      app.contextMenu.addItem({
        command: widget.commandIds.copy,
        selector,
        rank: 2,
      }),
      app.contextMenu.addItem({
        command: widget.commandIds.cut,
        selector,
        rank: 3,
      }),
      app.contextMenu.addItem({
        command: widget.commandIds.paste,
        selector,
        rank: 4,
      }),
      app.contextMenu.addItem({
        command: widget.commandIds.delete,
        selector,
        rank: 5,
      }),

      // the widget itself is a disposable
      widget,
    ].reduce((set: DisposableSet, d) => {
      set.add(d); return set;
    }, new DisposableSet());
  }
}
