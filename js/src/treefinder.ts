/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */
import { Format, IContentRow, Path, TreeFinderPanelElement } from "tree-finder";
import { ILayoutRestorer, IRouter, JupyterFrontEnd } from "@jupyterlab/application";
// import { Clipboard, Dialog, IWindowResolver, showDialog, showErrorMessage, Toolbar, ToolbarButton } from "@jupyterlab/apputils";
import { IWindowResolver, Toolbar } from "@jupyterlab/apputils";
// import { PathExt, URLExt } from "@jupyterlab/coreutils";
// import { IDocumentManager, isValidFileName, renameFile } from "@jupyterlab/docmanager";
import { IDocumentManager } from "@jupyterlab/docmanager";
import { DocumentRegistry } from "@jupyterlab/docregistry";
import { Contents, ContentsManager } from "@jupyterlab/services";
// import { newFolderIcon, refreshIcon } from "@jupyterlab/ui-components";
import { CommandRegistry } from "@lumino/commands";
import { DisposableSet, IDisposable } from "@lumino/disposable";
import { PanelLayout, Widget } from "@lumino/widgets";
// import JSZip from "jszip";

import { IFSResource } from "./filesystem";
import { fileTreeIcon } from "./icons";
// import { Uploader } from "./upload";
// import { CommandIDs, doRename, OpenDirectWidget, Patterns, switchView, writeZipFile } from "./utils";

export class JupyterContents {
  constructor(cm: ContentsManager, drive?: string) {
    this.cm = cm;
    this.drive = drive;
  }

  async get(path: string) {
    const opt = {content: true};
    const {kind, content, ...rest} = JupyterContents.toJupyterContentRow(await this.cm.get(path, opt), this.drive);

    return {
      kind,
      content,
      ...rest,
      ...(kind !== "dir" ? {} : {
        getChildren: () => content.map((x: Contents.IModel) => {
          return this._get(x);
        }),
      }),
    };
  }

  protected _get(row: Contents.IModel) {
    const {path, kind, ...rest} = JupyterContents.toJupyterContentRow(row, this.drive);

    return {
      path,
      kind,
      ...rest,
      ...(kind !== "dir" ? {} : {
        getChildren: async () => await (await this.get(Path.fromarray(path))).getChildren(),
      }),
    };
  }

  readonly cm: ContentsManager;
  readonly drive: string
}

export namespace JupyterContents {
  export interface JupyterContentRow extends Omit<Contents.IModel, "path">, IContentRow {}

  export function getPath(path: string, drive?: string) {
    if (drive && path.startsWith(`${drive}:`)) {
      return path;
    }

    return drive ? [drive, path].join(":") : path;
  }

  export function toJupyterContentRow(row: Contents.IModel, drive: string): JupyterContentRow {
    const {path, type, ...rest} = row;

    return {
      path: Path.toarray(getPath(path, drive)),
      kind: type === "directory" ? "dir" : type,
      type,
      ...rest,
    };
  }
}

export class TreeFinder extends Widget {
  cm: JupyterContents;
  dr: DocumentRegistry;
  commands: CommandRegistry;
  toolbar: Toolbar;
  table: HTMLTableElement;
  tree: HTMLElement;

  readonly node: TreeFinderPanelElement<JupyterContents.JupyterContentRow>;

  constructor({
    app,
    rootPath = "",
    caption = "TreeFinder",
    id = "jupyterlab-tree-finder",
  }: TreeFinder.IOptions) {

    const node = document.createElement<JupyterContents.JupyterContentRow>("tree-finder-panel");
    super({node});
    this.id = id;
    this.title.icon = fileTreeIcon;
    this.title.caption = caption;
    this.title.closable = true;
    this.addClass("jp-tree-finder");
    this.addClass(id);

    this.cm = new JupyterContents(app.serviceManager.contents, rootPath);
    this.dr = app.docRegistry;
    this.commands = app.commands;
    this.toolbar = new Toolbar<Widget>();

    this.toolbar.addClass("tree-finder-toolbar");
    this.toolbar.addClass(id);

    const layout = new PanelLayout();
    layout.addWidget(this.toolbar);

    this.layout = layout;

    rootPath = rootPath === "" ? rootPath : rootPath + ":";
    this.cm.get(rootPath).then(root => {
      this.node.init({
        root,
        gridOptions: {
          columnFormatters: {
            "last_modified": (x => Format.timeSince(x as any as Date)),
            "size": (x => Format.bytesToHumanReadable(x)),
          },
          doWindowReize: true,
          showFilter: true,
        },
        modelOptions: {
          columnNames: ["size", "mimetype", "last_modified"],
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

}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace TreeFinder {
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
    const widget = new TreeFinder({ app, rootPath, caption, id });
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
      // app.commands.addCommand((CommandIDs.toggle + ":" + widget.id), {
      //   execute: args => {
      //     const row = args.row as string;
      //     const level = args.level as number;

      //     let row_element: HTMLElement = widget.node.querySelector("[id='" + u_btoa(row) + "']");

      //     if (row_element.nextElementSibling && u_atob(row_element.nextElementSibling.id).startsWith(row + "/")) { // next element in folder, already constructed
      //       // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      //       const display = switchView((widget.node.querySelector("[id='" + row_element.nextElementSibling.id + "']") as HTMLElement).style.display);
      //       widget.controller[row].open = !(widget.controller[row].open);
      //       const open_flag = widget.controller[row].open;
      //       // open folder
      //       while (row_element.nextElementSibling && u_atob(row_element.nextElementSibling.id).startsWith(row + "/")) {
      //         row_element = (widget.node.querySelector("[id='" + row_element.nextElementSibling.id + "']"));
      //         // check if the parent folder is open
      //         if (!(open_flag) || widget.controller[PathExt.dirname(u_atob(row_element.id))].open) {
      //           row_element.style.display = display;
      //         }
      //       }
      //     } else { // if children elements don't exist yet
      //       const base = app.serviceManager.contents.get(widget.basepath + row);
      //       base.then(res => {
      //         widget.buildTableContents(res.content, level, row_element);
      //         widget.controller[row] = { last_modified: res.last_modified, open: true };
      //       });
      //     }
      //   },
      // }),

      // app.commands.addCommand((CommandIDs.navigate + ":" + widget.id), {
      //   execute: args => {
      //     // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
      //     const treeMatch = router.current.path.match(Patterns.tree);
      //     // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
      //     const workspaceMatch = router.current.path.match(Patterns.workspace);
      //     const match = treeMatch || workspaceMatch;
      //     const path = decodeURI(match[1]);
      //     // const { page, workspaces } = app.info.urls;
      //     const workspace = PathExt.basename(resolver.name);
      //     const url =
      //       (workspaceMatch ? URLExt.join(paths.urls.workspaces, workspace) : paths.urls.app) +
      //       router.current.search +
      //       router.current.hash;

      //     router.navigate(url);

      //     try {
      //       const tree_paths: string[] = [];
      //       const temp: string[] = path.split("/");
      //       let current = "";
      //       for (const t in temp) {
      //         current += (current === "") ? temp[t] : "/" + temp[t];
      //         tree_paths.push(current);
      //       }
      //       const array: Array<Promise<any>> = [];
      //       tree_paths.forEach(key => {
      //         array.push(app.serviceManager.contents.get(key));
      //       });
      //       Promise.all(array).then(results => {
      //         for (const r in results) {
      //           if (results[r].type === "directory") {
      //             const row_element = widget.node.querySelector("[id='" + u_btoa(results[r].path) + "']");
      //             widget.buildTableContents(results[r].content, 1 + results[r].path.split("/").length, row_element);
      //           }
      //         }
      //       });
      //     } catch (error) {
      //       // eslint-disable-next-line no-console
      //       console.warn("Tree routing failed.", error);
      //     }
      //   },
      // }),

      // app.commands.addCommand((CommandIDs.refresh + ":" + widget.id), {
      //   execute: () => {
      //     Object.keys(widget.controller).forEach(key => {
      //       const promise = app.serviceManager.contents.get(widget.basepath + key);
      //       promise.then(res => {
      //         if (res.last_modified > widget.controller[key].last_modified) {
      //           widget.controller[key].last_modified = res.last_modified;
      //         }
      //       });
      //       promise.catch(reason => {
      //         // eslint-disable-next-line no-console
      //         console.log(reason);
      //         delete widget.controller[key];
      //       });
      //     });
      //     widget.refresh();
      //   },
      // }),

      // app.commands.addCommand((CommandIDs.set_context + ":" + widget.id), {
      //   execute: args => {
      //     if (widget.selected !== "") {
      //       const element = (widget.node.querySelector("[id='" + u_btoa(widget.selected) + "']"));
      //       if (element !== null) {
      //         element.className = element.className.replace("selected", "");
      //       }
      //     }
      //     widget.selected = args.path as string;
      //     if (widget.selected !== "") {
      //       const element = widget.node.querySelector("[id='" + u_btoa(widget.selected) + "']");
      //       if (element !== null) {
      //         element.className += " selected";
      //       }
      //     }
      //   },
      //   label: "Need some Context",
      // }),

      // app.commands.addCommand((CommandIDs.select + ":" + widget.id), {
      //   execute: args => {
      //     if (widget.selected !== "") {
      //       // eslint-disable-next-line no-shadow
      //       const element = (widget.node.querySelector("[id='" + u_btoa(widget.selected) + "']"));
      //       if (element !== null) {
      //         element.className = element.className.replace("selected", "");
      //       }
      //     }
      //     if (args.path === "") {
      //       return;
      //     }
      //     widget.selected = args.path as string;
      //     const element = widget.node.querySelector("[id='" + u_btoa(widget.selected) + "']");
      //     if (element !== null) {
      //       element.className += " selected";
      //     }
      //   },
      //   label: "Select",
      // }),

      // app.commands.addCommand((CommandIDs.rename + ":" + widget.id), {
      //   execute: () => {
      //     const td = widget.node.querySelector("[id='" + u_btoa(widget.selected) + "']").
      //       getElementsByClassName("filetree-item-name")[0];
      //     const text_area = td.getElementsByClassName("filetree-name-span")[0] as HTMLElement;

      //     if (text_area === undefined) {
      //       return;
      //     }
      //     const original = text_area.innerHTML;
      //     const edit = document.createElement("input");
      //     edit.value = original;
      //     doRename(text_area, edit).then(newName => {
      //       if (!newName || newName === original) {
      //         return original;
      //       }
      //       if (!isValidFileName(newName)) {
      //         showErrorMessage(
      //           "Rename Error",
      //           Error(
      //             `"${newName}" is not a valid name for a file. ` +
      //               "Names must have nonzero length, " +
      //               "and cannot include \"/\", \"\\\", or \":\"",
      //           ),
      //         );
      //         return original;
      //       }
      //       const current_id = widget.selected;
      //       const new_path = PathExt.join(PathExt.dirname(widget.selected), newName);
      //       renameFile(manager, widget.basepath + current_id, widget.basepath + new_path);
      //       widget.updateController(current_id, new_path);
      //       text_area.innerHTML = newName;
      //       widget.refresh();
      //     });
      //   },
      //   iconClass: "p-Menu-itemIcon jp-MaterialIcon jp-EditIcon",
      //   label: "Rename",
      // }),

      // app.commands.addCommand((CommandIDs.create_folder + ":" + widget.id), {
      //   execute: async args => {
      //     await manager.newUntitled({
      //       path: widget.basepath + (args.path as string || widget.selected),
      //       type: "directory",
      //     });
      //     widget.refresh();
      //   },
      //   iconClass: "p-Menu-itemIcon jp-MaterialIcon jp-NewFolderIcon",
      //   label: "New Folder",
      // }),

      // app.commands.addCommand((CommandIDs.create_file + ":" + widget.id), {
      //   execute: () => {
      //     showDialog({
      //       body: new OpenDirectWidget(),
      //       buttons: [Dialog.cancelButton(), Dialog.okButton({ label: "CREATE" })],
      //       focusNodeSelector: "input",
      //       title: "Create File",
      //     }).then((result: any) => {
      //       if (result.button.label === "CREATE") {
      //         const new_file = PathExt.join(widget.selected, result.value);
      //         manager.createNew(widget.basepath + new_file);
      //         if (!(widget.selected in widget.controller) || widget.controller[widget.selected].open === false) {
      //           app.commands.execute((CommandIDs.toggle + ":" + widget.id), { row: widget.selected, level: new_file.split("/").length });
      //         }
      //         widget.refresh();
      //       }
      //     });
      //   },
      //   iconClass: "p-Menu-itemIcon jp-MaterialIcon jp-AddIcon",
      //   label: "New File",
      // }),

      // app.commands.addCommand((CommandIDs.delete_op + ":" + widget.id), {
      //   execute: () => {
      //     const message = `Are you sure you want to delete: ${widget.selected} ?`;
      //     showDialog({
      //       body: message,
      //       buttons: [Dialog.cancelButton(), Dialog.warnButton({ label: "DELETE" })],
      //       title: "Delete",
      //     }).then(async (result: any) => {
      //       if (result.button.accept) {
      //         await manager.deleteFile(widget.basepath + widget.selected);
      //         widget.updateController(widget.selected, "");
      //         app.commands.execute((CommandIDs.set_context + ":" + widget.id), { path: "" });
      //         widget.refresh();
      //       }
      //     });
      //   },
      //   iconClass: "p-Menu-itemIcon jp-MaterialIcon jp-CloseIcon",
      //   label: "Delete",
      // }),

      // app.commands.addCommand((CommandIDs.download + ":" + widget.id), {
      //   execute: args => {
      //     widget.download(widget.selected, args.folder as boolean || false);
      //   },
      //   iconClass: "p-Menu-itemIcon jp-MaterialIcon jp-DownloadIcon",
      //   label: "Download",
      // }),

      // app.commands.addCommand((CommandIDs.upload + ":" + widget.id), {
      //   execute: () => {
      //     uploader_button.contextClick(widget.selected);
      //   },
      //   iconClass: "p-Menu-itemIcon jp-MaterialIcon jp-FileUploadIcon",
      //   label: "Upload",
      // }),

      // app.commands.addCommand((CommandIDs.move + ":" + widget.id), {
      //   execute: args => {
      //     const from = args.from as string;
      //     const to = args.to as string;
      //     const file_name = PathExt.basename(from);
      //     const message = "Are you sure you want to move " + file_name + "?";
      //     showDialog({
      //       body: message,
      //       buttons: [Dialog.cancelButton(), Dialog.warnButton({ label: "MOVE" })],
      //       title: "Move",
      //     }).then((result: any) => {
      //       if (result.button.accept) {
      //         const new_path = PathExt.join(to, file_name);
      //         renameFile(manager, widget.basepath + from, widget.basepath + new_path);
      //         widget.updateController(from, new_path);
      //         widget.refresh();
      //       }
      //     });
      //   },
      //   label: "Move",
      // }),

      // app.commands.addCommand((CommandIDs.copy_path + ":" + widget.id), {
      //   execute: () => {
      //     Clipboard.copyToSystem(widget.selected);
      //   },
      //   iconClass: widget.dr.getFileType("text").iconClass,
      //   label: "Copy Path",
      // }),

      // app.contextMenu.addItem({
      //   command: (CommandIDs.rename + ":" + widget.id),
      //   rank: 3,
      //   selector: "div." + widget.id + " > table > *> .filetree-item",
      // }),

      // app.contextMenu.addItem({
      //   command: (CommandIDs.delete_op + ":" + widget.id),
      //   rank: 4,
      //   selector: "div." + widget.id + " > table > *> .filetree-item",
      // }),

      // app.contextMenu.addItem({
      //   command: (CommandIDs.copy_path + ":" + widget.id),
      //   rank: 5,
      //   selector: "div." + widget.id + " > table > *> .filetree-item",
      // }),

      // app.contextMenu.addItem({
      //   command: (CommandIDs.download + ":" + widget.id),
      //   rank: 1,
      //   selector: "div." + widget.id + " > table > *> .filetree-file",
      // }),

      // app.contextMenu.addItem({
      //   command: (CommandIDs.create_folder + ":" + widget.id),
      //   rank: 2,
      //   selector: "div." + widget.id + " > table > * > .filetree-folder",
      // }),

      // app.contextMenu.addItem({
      //   command: (CommandIDs.create_file + ":" + widget.id),
      //   rank: 1,
      //   selector: "div." + widget.id + " > table > * > .filetree-folder",
      // }),

      // app.contextMenu.addItem({
      //   command: (CommandIDs.upload + ":" + widget.id),
      //   rank: 3,
      //   selector: "div." + widget.id + " > table > * > .filetree-folder",
      // }),

      // app.contextMenu.addItem({
      //   args: { folder: true },
      //   command: (CommandIDs.download + ":" + widget.id),
      //   rank: 1,
      //   selector: "div." + widget.id + " > table > *> .filetree-folder",
      // }),

      // router.register({ command: (CommandIDs.navigate + ":" + widget.id), pattern: Patterns.tree }),
      // router.register({ command: (CommandIDs.navigate + ":" + widget.id), pattern: Patterns.workspace }),

      widget,
    ].reduce((set: DisposableSet, d) => {
      set.add(d); return set;
    }, new DisposableSet());
  }
}
