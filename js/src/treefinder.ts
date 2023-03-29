/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */
import { ILayoutRestorer, IRouter, JupyterFrontEnd } from "@jupyterlab/application";
import {
  IWindowResolver,
  showErrorMessage,
  Toolbar,
  ToolbarButton,
  WidgetTracker, /*Clipboard, Dialog, IWindowResolver, showDialog*/
} from "@jupyterlab/apputils";
// import { PathExt, URLExt } from "@jupyterlab/coreutils";
import { IDocumentManager, isValidFileName /*renameFile*/ } from "@jupyterlab/docmanager";
// import { DocumentRegistry } from "@jupyterlab/docregistry";
import { Contents, ContentsManager } from "@jupyterlab/services";
import { ISettingRegistry } from "@jupyterlab/settingregistry";
import {
  closeIcon,
  copyIcon,
  cutIcon,
  editIcon,
  filterListIcon,
  pasteIcon,
  refreshIcon,
} from "@jupyterlab/ui-components";
// import JSZip from "jszip";
import { DisposableSet, IDisposable } from "@lumino/disposable";
import { Menu, PanelLayout, Widget } from "@lumino/widgets";
import { Content, Format, IContentRow, Path, TreeFinderPanelElement } from "tree-finder";

import { JupyterClipboard } from "./clipboard";
import { IFSResource } from "./filesystem";
import { fileTreeIcon } from "./icons";
import { doRename } from "./utils";
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

  async rename(path: string, newPath: string) {
    path = JupyterContents.toFullPath(path, this.drive);
    newPath = JupyterContents.toFullPath(newPath, this.drive);
    return JupyterContents.toJupyterContentRow(await this.cm.rename(path, newPath), this.cm, this.drive);
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

export class TreeFinderTracker extends WidgetTracker<TreeFinderSidebar> {
  async add(finder: TreeFinderSidebar) {
    this._finders.set(finder.id, finder);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    finder.disposed.connect(this._onWidgetDisposed, this);

    return super.add(finder);
  }

  remove(finder: TreeFinderSidebar) {
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

  private _onWidgetDisposed(finder: TreeFinderSidebar) {
    this.remove(finder);
  }

  private _finders = new Map<string, TreeFinderSidebar>();
}

export class TreeFinderWidget extends Widget {
  constructor({
    app,
    settings,
    rootPath = "",
  }: TreeFinderSidebar.IOptions) {
    const { commands, serviceManager: { contents } } = app;

    const node = document.createElement<JupyterContents.IJupyterContentRow>("tree-finder-panel");
    super({ node });
    this.addClass("jp-tree-finder");

    this.cm = new JupyterContents(contents, rootPath);
    this.settings = settings;
    this.columns = settings.composite.display_columns as (keyof JupyterContents.IJupyterContentRow)[];
    this.rootPath = rootPath === "" ? rootPath : rootPath + ":";
    this.nodeInit().then(() => {
      this.model.openSub.subscribe(rows => rows.forEach(row => {
        if (!row.getChildren) {
          void commands.execute("docmanager:open", { path: Path.fromarray(row.path) });
        }
      }));
    });
  }

  draw() {
    this.model.requestDraw();
  }

  refresh() {
    this.model.refreshSub.next();
  }

  // TODO: Avoid hardcoding the order of columns.
  async toggleColumn(col: (keyof JupyterContents.IJupyterContentRow)) {
    // Preserve the position of the columns in order [size, last_modified, mimetype]
    let idx = this.columns.indexOf(col, 0);
    if (idx !== -1) {
      this.columns.splice(idx, 1);
    }
    else {
      let pos = 0;
      if (col === 'last_modified') {
        let mimetype_idx = this.columns.indexOf('mimetype', 0);
        let size_idx = this.columns.indexOf('size', 0);
        if (mimetype_idx !== -1 && size_idx == -1) { pos = mimetype_idx - 1; }
        else { pos = 1 }
      }
      else if (col === 'mimetype') {
        pos = 2;
      }
      this.columns.splice(pos, 0, col);
    }

    // Update the new list of columns to the ContentsModel's options
    let m = this.model;
    m.options = {
      ...m.options, 
      columnNames: this.columns, 
    };
    m.initColumns();
    this.nodeInit();

    this.settings.set("display_columns", this.columns);
  }

  async nodeInit() {
    await this.cm.get(this.rootPath).then(root => this.node.init({
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
        columnNames: this.columns,
      },
    }))
  }

  get model() {
    return this.node.model;
  }

  get selection() {
    return this.model.selection;
  }

  get selectionPathstrs() {
    return this.model.selection.map(c => Path.fromarray(c.row.path));
  }
  
  cm: JupyterContents;
  commands: any;
  rootPath: string;
  columns: (keyof JupyterContents.IJupyterContentRow)[];
  settings: ISettingRegistry.ISettings;
  readonly node: TreeFinderPanelElement<JupyterContents.IJupyterContentRow>;
}

export class TreeFinderSidebar extends Widget {
  constructor({
    app,
    settings,
    rootPath = "",
    caption = "TreeFinder",
    id = "jupyterlab-tree-finder",
  }: TreeFinderSidebar.IOptions) {
    super();
    this.id = id;
    this.title.icon = fileTreeIcon;
    this.title.caption = caption;
    this.title.closable = true;
    this.addClass("jp-tree-finder-sidebar");

    // each separate widget gets its own unique commands, with each commandId prefixed with the widget's unique id
    // TODO: check on edge cases where two widget's share id (ie when two widgets are both views onto the same ContentsManager on the backend)
    this.commandIDs = Object.fromEntries(TreeFinderSidebar.commandNames.map(name => [name, `${this.id}:treefinder:${name}`])) as TreeFinderSidebar.ICommandIDs;

    // this.dr = app.docRegistry;


    this.toolbar = new Toolbar();
    this.toolbar.addClass("jp-tree-finder-toolbar");
    // this.toolbar.addClass(id);

    this.treefinder = new TreeFinderWidget({ app, rootPath, settings });

    this.layout = new PanelLayout();
    this.layout.addWidget(this.toolbar);
    this.layout.addWidget(this.treefinder);
  }

  restore() { // restore expansion prior to rebuild
    this.treefinder.refresh();
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
    this.treefinder.refresh();
    this.treefinder.draw();
  }

  protected onResize(msg: any): void {
    this.treefinder.draw();
  }

  cm: JupyterContents;
  // dr: DocumentRegistry;
  toolbar: Toolbar;
  treefinder: TreeFinderWidget;

  readonly commandIDs: TreeFinderSidebar.ICommandIDs;
  readonly layout: PanelLayout;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace TreeFinderSidebar {
  const namespace = "jupyter-fs:TreeFinder";

  // define the command ids as a constant tuple
  export const commandNames = [
    "copy",
    "cut",
    "delete",
    "open",
    "paste",
    "refresh",
    "rename",
    "togglePath",
    "toggleSizeCol",
    "toggleMimetypeCol",
    "toggleLastModifiedCol"
  ] as const;
  // use typescript-fu to convert commandIds to an interface
  export type ICommandIDs = {[k in typeof commandNames[number]]: string};

  export const tracker = new TreeFinderTracker({ namespace });
  export const clipboard = new JupyterClipboard(tracker);

  export interface IOptions {
    app: JupyterFrontEnd;
    settings: ISettingRegistry.ISettings;

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
    settings: ISettingRegistry.ISettings;

    side?: string;
  }

  export function sidebarFromResource(resource: IFSResource, props: TreeFinderSidebar.ISidebarProps): IDisposable {
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
    settings,

    rootPath = "",
    caption = "TreeFinder",
    id = "jupyterlab-tree-finder",
    side = "left",
  }: TreeFinderSidebar.ISidebarProps): IDisposable {
    const selector = `#${id}`;
    const widget = new TreeFinderSidebar({ app, rootPath, settings, caption, id });
    void tracker.add(widget);
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
    const refresh_button = new ToolbarButton({
      icon: refreshIcon,
      onClick: () => {
        void app.commands.execute(widget.commandIDs.refresh);
      },
      tooltip: "Refresh",
    });

    const colsToDisplay = settings.composite.display_columns as string[];
    let size_col_state = colsToDisplay.indexOf('size') > -1;
    let mimetype_col_state = colsToDisplay.indexOf('mimetype') > -1;
    let lastModified_col_state = colsToDisplay.indexOf('last_modified') > -1;

    let submenu = new Menu({ commands: app.commands});
    submenu.title.label = 'Show/Hide Columns';
    submenu.title.icon = filterListIcon;
    submenu.addItem({ command: widget.commandIDs.togglePath });
    submenu.addItem({ command: widget.commandIDs.toggleSizeCol });
    submenu.addItem({ command: widget.commandIDs.toggleLastModifiedCol });
    submenu.addItem({ command: widget.commandIDs.toggleMimetypeCol });

    // widget.toolbar.addItem("upload", uploader_button);
    // widget.toolbar.addItem("new file", new_file_button);
    widget.toolbar.addItem("refresh", refresh_button);

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
      app.commands.addCommand(widget.commandIDs.copy, {
        execute: args => clipboard.model.copySelection(widget.treefinder.model),
        icon: copyIcon,
        label: "Copy",
      }),
      app.commands.addCommand(widget.commandIDs.cut, {
        execute: args => clipboard.model.cutSelection(widget.treefinder.model),
        icon: cutIcon,
        label: "Cut",
      }),
      app.commands.addCommand(widget.commandIDs.delete, {
        execute: args => clipboard.model.deleteSelection(widget.treefinder.model),
        icon: closeIcon.bindprops({ stylesheet: "menuItem" }),
        label: "Delete",
      }),
      app.commands.addCommand(widget.commandIDs.open, {
        execute: args => widget.treefinder.model.openSub.next(widget.treefinder.selection.map(c => c.row)),
        label: "Open",
      }),
      app.commands.addCommand(widget.commandIDs.paste, {
        execute: args => clipboard.model.pasteSelection(widget.treefinder.model),
        icon: pasteIcon,
        label: "Paste",
      }),
      app.commands.addCommand(widget.commandIDs.rename, {
        execute: args => {
          const oldContent = widget.treefinder.selection[0];
          void _doRename(widget, oldContent).then(newContent => {
            widget.treefinder.model.renamerSub.next( { name: newContent.name, target: oldContent } );
            // TODO: Model state of TreeFinderWidget should be updated by renamerSub process.
            oldContent.row = newContent;
          });
        },
        icon: editIcon,
        label: "Rename",
      }),
      app.commands.addCommand(widget.commandIDs.refresh, {
        execute: args => args["selection"] ? clipboard.refreshSelection(widget.treefinder.model) : clipboard.refresh(widget.treefinder.model),
        icon: refreshIcon,
        label: args => args["selection"] ? "Refresh Selection" : "Refresh",
      }),
      app.commands.addCommand(widget.commandIDs.togglePath, {
        execute: args => {},
        label: 'path',
        isEnabled: () => false,
        isToggled: () => true,
      }),
      app.commands.addCommand(widget.commandIDs.toggleSizeCol, {
        execute: async args => {
          const widget = tracker.currentWidget;
          if (widget) {
            size_col_state = !size_col_state;
            await widget.treefinder.toggleColumn('size');
          }
        },
        label: 'size',
        isToggleable: true,
        isToggled: () => size_col_state,
      }),
      app.commands.addCommand(widget.commandIDs.toggleLastModifiedCol, {
        execute: async args => {
          const widget = tracker.currentWidget;
          if (widget) {
            lastModified_col_state = !lastModified_col_state;
            await widget.treefinder.toggleColumn('last_modified');
          }
        },
        label: 'last_modified',
        isToggleable: true,
        isToggled: () => lastModified_col_state,
      }),
      app.commands.addCommand(widget.commandIDs.toggleMimetypeCol, {
        execute: async args => {
          const widget = tracker.currentWidget;
          if (widget) {
            mimetype_col_state = !mimetype_col_state;
            await widget.treefinder.toggleColumn('mimetype');
          }
        },
        label: 'mimetype',
        isToggleable: true,
        isToggled: () => mimetype_col_state,
      }),

      // context menu items
      app.contextMenu.addItem({
        command: widget.commandIDs.open,
        selector,
        rank: 1,
      }),

      app.contextMenu.addItem({
        command: widget.commandIDs.copy,
        selector,
        rank: 2,
      }),
      app.contextMenu.addItem({
        command: widget.commandIDs.cut,
        selector,
        rank: 3,
      }),
      app.contextMenu.addItem({
        command: widget.commandIDs.paste,
        selector,
        rank: 4,
      }),
      app.contextMenu.addItem({
        command: widget.commandIDs.delete,
        selector,
        rank: 5,
      }),
      app.contextMenu.addItem({
        command: widget.commandIDs.rename,
        selector,
        rank: 6,
      }),
      app.contextMenu.addItem({
        type: 'submenu',
        submenu: submenu,
        selector,
        rank: 7,
      }),
      app.contextMenu.addItem({
        args: { selection: true },
        command: widget.commandIDs.refresh,
        selector,
        rank: 10,
      }),

      // the widget itself is a disposable
      widget,
    ].reduce((set: DisposableSet, d) => {
      set.add(d); return set;
    }, new DisposableSet());
  }

  export function _doRename(widget: TreeFinderSidebar, oldContent: Content<JupyterContents.IJupyterContentRow>): Promise<JupyterContents.IJupyterContentRow> {
    const textNode = document.querySelector(".tf-mod-select .rt-tree-container .rt-group-name").firstChild as HTMLElement;
    const original = textNode.textContent;
    const editNode = document.createElement("input");
    editNode.value = original;
    return doRename(textNode, editNode, original).then(
      newName => {
        if (!newName || newName === oldContent.name) {
          return oldContent.row;
        }
        if (!isValidFileName(newName)) {
          void showErrorMessage(
            "Rename Error",
            Error(newName +' is not a valid name for a file. Names must have nonzero length, and cannot include "/", "\\", or ":"')
          );
          return oldContent.row;
        }
        const oldPath = oldContent.getPathAtDepth(1).join("/");
        const newPath = oldPath.slice(0, -1 * original.length) + newName;
        const promise = widget.treefinder.cm.rename(oldPath, newPath);
        return promise
          .catch(error => {
            if (error !== "File not renamed") {
              void showErrorMessage(
                "Rename Error",
                error
              );
            }
            return oldContent.row;
          })
          .then(newContent => {
            textNode.textContent = newName;
            return newContent;
          });
      }
    );
  }
}
