/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { JupyterFrontEnd } from "@jupyterlab/application";
import { Dialog, showDialog } from "@jupyterlab/apputils";
import { DocumentRegistry } from "@jupyterlab/docregistry";
import {
  closeIcon,
  copyIcon,
  cutIcon,
  downloadIcon,
  editIcon,
  filterListIcon,
  pasteIcon,
  refreshIcon,
  fileIcon,
  newFolderIcon,
  RankedMenu,
  IDisposableMenuItem,
} from "@jupyterlab/ui-components";
import { map } from "@lumino/algorithm";
import { DisposableSet, IDisposable } from "@lumino/disposable";
import { ContextMenu, Menu } from "@lumino/widgets";
import { Content, Path } from "@tree-finder/base";


import { JupyterClipboard } from "./clipboard";
import { TreeFinderSidebar } from "./treefinder";
import type { IFSResource } from "./filesystem";
import type { ContentsProxy } from "./contents_proxy";
import type { TreeFinderTracker } from "./treefinder";
import { getContentParent, getRefreshTargets, openDirRecursive, revealAndSelectPath, splitPathstrDrive } from "./contents_utils";
import { ISettingRegistry } from "@jupyterlab/settingregistry";
import { showErrorMessage } from "@jupyterlab/apputils";
import { getAllSnippets, instantiateSnippet, Snippet } from "./snippets";

// define the command ids as a constant tuple
export const commandNames = [
  "copy",
  "cut",
  "delete",
  "open",
  "openWith",
  "paste",
  "refresh",
  "rename",
  "download",
  "create_folder",
  "create_file",
  // "navigate",
  "copyFullPath",
  "copyRelativePath",
  "restore",
  "toggleColumnPath",
  "toggleColumn",
] as const;


export const commandIDs = Object.fromEntries(commandNames.map(
  name => [name, `treefinder:${name}`]
)) as CommandIDs;
export type CommandIDs = {[k in typeof commandNames[number]]: string};


const COLUMN_NAMES = [
  "size",
  "last_modified",
  "writable",
  "mimetype",
];


export function idFromResource(resource: IFSResource): string {
  return [resource.name.split(" ").join(""), resource.drive].join("_");
}


const currentWidgetSelectionIsWritable = (tracker: TreeFinderTracker): boolean => {
  if (!tracker.currentWidget) {
    return false;
  }
  const selection = tracker.currentWidget.treefinder.model?.selection;
  if (selection) {
    return selection.every((x: Content<ContentsProxy.IJupyterContentRow>) => x.row.writable);
  }
  return false;
};

function toggleColumnCommandId(column: string): string {
  return `${commandIDs.toggleColumn}-${column}`;
}


function _getRelativePaths(selectedFiles: Array<Content<ContentsProxy.IJupyterContentRow>>): string[] {
  const allPaths: string[] = [];
  for (const file of selectedFiles) {
    const relativePath = file.getPathAtDepth(1).join("/");
    allPaths.push(relativePath);
  }
  return allPaths;
}


async function _digestString(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value); // encode as (utf-8) Uint8Array
  const buffer = await crypto.subtle.digest("SHA-256", encoded); // hash the message
  const hash = Array.from(new Uint8Array(buffer)); // convert buffer to byte array
  return hash
    .map(b => b.toString(16).padStart(2, "0"))
    .join(""); // convert bytes to hex string
}


async function _commandKeyForSnippet(snippet: Snippet): Promise<string>  {
  return `jupyterfs:snippet-${snippet.label}-${await _digestString(snippet.label + snippet.caption + snippet.pattern.source + snippet.template)}`;
}

function _openWithKeyForFactory(factory: string): string  {
  return `jupyterfs:openwith-${factory}`;
}

function _normalizedUrlForSnippet(content: Content<ContentsProxy.IJupyterContentRow>, baseUrl: string): string {
  const path = splitPathstrDrive(content.pathstr)[1];
  return `${baseUrl}/${path}${content.hasChildren ? "/" : ""}`;
}

/**
 * Create commands that will have the same IDs indepent of settings/resources
 *
 * These commands do not need to be recreated on settings/resource updates
 */
export function createStaticCommands(
  app: JupyterFrontEnd,
  tracker: TreeFinderTracker,
  clipboard: JupyterClipboard,
): IDisposable {
  return [
    app.commands.addCommand(commandIDs.copy, {
      execute: args => clipboard.model.copySelection(tracker.currentWidget!.treefinder.model!),
      icon: copyIcon,
      label: "Copy",
      isVisible: () => {
        const widget = tracker.currentWidget;
        if (!widget) {
          return false;
        }
        // Copy of folders are unsupported
        if (widget.treefinder.model?.selection.some(v => v.row.kind === "dir")) {
          return false;
        }
        return true;
      },
      isEnabled: () => !!tracker.currentWidget,
    }),
    app.commands.addCommand(commandIDs.cut, {
      execute: args => clipboard.model.cutSelection(tracker.currentWidget!.treefinder.model!),
      icon: cutIcon,
      label: "Cut",
      isEnabled: () => currentWidgetSelectionIsWritable(tracker),
    }),
    app.commands.addCommand(commandIDs.delete, {
      execute: async args => {
        const treefinder = tracker.currentWidget!.treefinder;
        const model = treefinder.model!;
        const message =
        model.selection.length === 1
          ? `Are you sure you want to permanently delete: ${model.selection[0].name}?`
          : `Are you sure you want to permanently delete the ${model.selection.length} selected items?`;
        const result = await showDialog({
          title: "Delete",
          body: message,
          buttons: [
            Dialog.cancelButton({ label: "Cancel" }),
            Dialog.warnButton({ label: "Delete" }),
          ],
          // By default focus on "Cancel" to protect from accidental deletion
          defaultButton: 0,
        });

        if (!treefinder.isDisposed && result.button.accept) {
          clipboard.model.deleteSelection(model);
        }
      },
      icon: closeIcon.bindprops({ stylesheet: "menuItem" }),
      label: "Delete",
      isEnabled: () => currentWidgetSelectionIsWritable(tracker),
    }),
    app.commands.addCommand(commandIDs.open, {
      execute: args => tracker.currentWidget!.treefinder.model!.openSub.next(tracker.currentWidget!.treefinder.selection?.map(c => c.row) || []),
      label: "Open",
      isEnabled: () => !!tracker.currentWidget,
    }),

    app.commands.addCommand(commandIDs.paste, {
      execute: args => clipboard.model.pasteSelection(tracker.currentWidget!.treefinder.model!),
      icon: pasteIcon,
      label: "Paste",
      isEnabled: () => !!tracker.currentWidget,
    }),
    app.commands.addCommand(commandIDs.rename, {
      execute: args => {
        const widget = tracker.currentWidget!;
        const oldContent = widget.treefinder.selection![0];
        void TreeFinderSidebar.doRename(widget, oldContent).then(newContent => {
          widget.treefinder.model?.renamerSub.next( { name: newContent.name, target: oldContent } );
          // TODO: Model state of TreeFinderWidget should be updated by renamerSub process.
          oldContent.row = newContent;
        });
      },
      icon: editIcon,
      label: "Rename",
      isEnabled: () => currentWidgetSelectionIsWritable(tracker),
    }),
    app.commands.addCommand(commandIDs.download, {
      execute: async args => {
        const widget = tracker.currentWidget!;
        const selection = widget.treefinder.selection!;
        await Promise.allSettled(selection.map(s => widget.download(s.pathstr, s.hasChildren)));
      },
      icon: downloadIcon,
      label: "Download",
      isEnabled: () => !!(
        tracker.currentWidget?.treefinder.model?.selection?.some(s => !s.hasChildren)
      ),
    }),
    app.commands.addCommand(commandIDs.create_folder, {
      execute: async args =>  {
        const widget = tracker.currentWidget!;
        const model = widget.treefinder.model!;
        let target = model.selectedLast ?? model.root;
        if (!target.hasChildren) {
          target = await getContentParent(target, model.root);
        }
        const path = Path.fromarray(target.row.path);
        let row: ContentsProxy.IJupyterContentRow;
        try {
          row = await widget.treefinder.contentsProxy.newUntitled({
            type: "directory",
            path,
          });
        } catch (e) {
          void showErrorMessage("Could not create folder", e as string);
          return;
        }
        target.invalidate();
        const content = await revealAndSelectPath(model, row.path);
        // Is this really needed?
        model.refreshSub.next(getRefreshTargets([target.row], model.root) || []);
        // Scroll into view if not visible
        await TreeFinderSidebar.scrollIntoView(widget.treefinder, content.pathstr);
        const newContent = await TreeFinderSidebar.doRename(widget, content);
        model.renamerSub.next( { name: newContent.name, target: content } );
        // TODO: Model state of TreeFinderWidget should be updated by renamerSub process.
        content.row = newContent;
      },
      icon: newFolderIcon,
      label: "New Folder",
      isEnabled: () => !!tracker.currentWidget,
    }),
    app.commands.addCommand(commandIDs.create_file, {
      execute: async args =>  {
        const widget = tracker.currentWidget!;
        const model = widget.treefinder.model!;
        let target = model.selectedLast ?? model.root;
        if (!target.hasChildren) {
          target = await getContentParent(target, model.root);
        }
        const path = Path.fromarray(target.row.path);
        let row: ContentsProxy.IJupyterContentRow;
        try {
          row = await widget.treefinder.contentsProxy.newUntitled({
            type: "file",
            path,
          });
        } catch (e) {
          void showErrorMessage("Could not create file", e as string);
          return;
        }
        target.invalidate();
        const content = await revealAndSelectPath(model, row.path);
        // Is this really needed?
        model.refreshSub.next(getRefreshTargets([target.row], model.root) || []);
        // Scroll into view if not visible
        await TreeFinderSidebar.scrollIntoView(widget.treefinder, content.pathstr);
        const newContent = await TreeFinderSidebar.doRename(widget, content);
        model.renamerSub.next( { name: newContent.name, target: content } );
        // TODO: Model state of TreeFinderWidget should be updated by renamerSub process.
        content.row = newContent;
      },
      icon: fileIcon,
      label: "New File",
      isEnabled: () => !!tracker.currentWidget,
    }),
    app.commands.addCommand(commandIDs.refresh, {
      execute: args => {
        if (args["selection"]) {
          clipboard.refreshSelection(tracker.currentWidget!.treefinder.model!);
        } else {
          clipboard.refresh(tracker.currentWidget!.treefinder.model);
        }
      },
      icon: refreshIcon,
      label: args => args["selection"] ? "Refresh Selection" : "Refresh",
      isEnabled: () => !!tracker.currentWidget,
    }),
    app.commands.addCommand(commandIDs.copyFullPath, {
      execute: async args => {
        const widget = tracker.currentWidget!;
        const trimEnd = (path: string): string => path.trimEnd().replace(/\/+$/, "");
        const fullPaths = _getRelativePaths(widget.treefinder.selection!).map(relativePath => [trimEnd(widget.url ?? ""), relativePath].join("/"));
        await navigator.clipboard.writeText(fullPaths.join("\n"));
      },
      label: "Copy Full Path",
      isEnabled: () => !!tracker.currentWidget,
    }),
    app.commands.addCommand(commandIDs.copyRelativePath, {
      execute: async args => {
        const widget = tracker.currentWidget!;
        const relativePaths = _getRelativePaths(widget.treefinder.selection!);
        await navigator.clipboard.writeText(relativePaths.join("\n"));
      },
      label: "Copy Relative Path",
      isEnabled: () => !!tracker.currentWidget,
    }),
    app.commands.addCommand(commandIDs.toggleColumnPath, {
      execute: args => { /* no-op */ },
      label: "path",
      isEnabled: () => false,
      isToggled: () => true,
    }),
    app.commands.addCommand(commandIDs.restore, {
      execute: async args => {
        const rootPath = args.rootPath as string;
        const dirsToOpen = rootPath.split("/");
        const sidebar = tracker.findByDrive(args.id as string);
        if (!sidebar) {
          throw new Error(`Could not restore JupyterFS browser: ${args.id}`);
        }
        const treefinderwidget = sidebar.treefinder;
        const model = treefinderwidget.model!;

        // If preferredDir not specified, proceed with the restore
        if (!sidebar.preferredDir) {
          await openDirRecursive(model, dirsToOpen);
          await tracker.save(sidebar);
        }
      },
    }),
  ].reduce((set: DisposableSet, d) => {
    set.add(d); return set;
  }, new DisposableSet());
}


/**
 * Create commands whose count/IDs depend on settings/resources
 */
export async function createDynamicCommands(
  app: JupyterFrontEnd,
  tracker: TreeFinderTracker,
  clipboard: JupyterClipboard,
  resources: IFSResource[],
  settings?: ISettingRegistry.ISettings,
): Promise<IDisposable> {
  const columnCommands = [];
  const toggleState: {[key: string]: boolean} = {};
  const colsToDisplay = settings?.composite.display_columns as string[] ?? ["size"];
  const columnsMenu = new Menu({ commands: app.commands });
  columnsMenu.title.label = "Show/Hide Columns";
  columnsMenu.title.icon = filterListIcon;
  columnsMenu.addItem({ command: commandIDs.toggleColumnPath });
  for (const column of COLUMN_NAMES) {
    columnsMenu.addItem({ command: toggleColumnCommandId(column) });
    toggleState[column] = colsToDisplay.includes(column);
    columnCommands.push(app.commands.addCommand(toggleColumnCommandId(column), {
      execute: async args => {
        toggleState[column] = !toggleState[column];
        await settings?.set("display_columns", COLUMN_NAMES.filter(k => toggleState[k]));
      },
      label: column,
      isToggleable: true,
      isToggled: () => toggleState[column],
    }));
  }


  const snippetsMenu = new Menu({ commands: app.commands });
  snippetsMenu.title.label = "Snippets";
  const snippets = await getAllSnippets(settings);
  const snippetCommands = [] as IDisposable[];
  const snippetIds = new Set<string>();
  for (const snippet of snippets) {
    const key = await _commandKeyForSnippet(snippet);
    if (snippetIds.has(key)) {
      console.warn("Discarding duplicate snippet", snippet);
      continue;
    }
    snippetIds.add(key);
    snippetsMenu.addItem({ command: key });
    snippetCommands.push(app.commands.addCommand(key, {
      execute: async (args: unknown) => {
        const sidebar = tracker.currentWidget!;
        const content = sidebar.treefinder.selection![0];
        const instantiated = instantiateSnippet(snippet.template, sidebar.url, sidebar.type, content.pathstr);
        await navigator.clipboard.writeText(instantiated);
      },
      label: snippet.label,
      caption: snippet.caption,
      isVisible: () => {
        const sidebar = tracker.currentWidget;
        const selection = sidebar?.treefinder.selection;
        // discard if not for backend type
        if (snippet.type !== "" && snippet.type !== sidebar?.type) {
          return false;
        }
        // include if matches pattern
        if (selection?.length) {
          return snippet.pattern.test(_normalizedUrlForSnippet(selection[0], sidebar!.url));
        }
        return false;
      },
    }));
  }

  const openWithCommands = [] as IDisposable[];
  const openWithMenu = new Menu({ commands: app.commands });
  openWithMenu.title.label = "Open With";
  openWithMenu.id = "treefinder:open-with";
  const { docRegistry } = app;

  let items: IDisposableMenuItem[] = [];

  function updateOpenWithMenu(contextMenu: ContextMenu) {
    const openWith =
      (contextMenu.menu.items.find(
        item =>
          item.type === "submenu" &&
          item.submenu?.id === "treefinder:open-with"
      )?.submenu as RankedMenu) ?? null;

    if (!openWith) {
      return; // Bail early if the open with menu is not displayed
    }

    // clear the current menu items
    // items.forEach(item => item.dispose());
    items.length = 0;
    // Ensure that the menu is empty
    openWith.clearItems();

    // clear the commands
    openWithCommands.forEach(item => item.dispose());
    openWithCommands.length = 0;

    // get the widget factories that could be used to open all of the items
    // in the current filebrowser selection
    const widget = tracker.currentWidget!;
    const treefinder = widget.treefinder;
    const model = treefinder.model!;
    const factories = tracker.currentWidget
      ? intersection<DocumentRegistry.WidgetFactory>(
        map(model.selection, i => getFactories(docRegistry, widget, i))
      )
      : new Set<DocumentRegistry.WidgetFactory>();

    // make new menu items from the widget factories
    items = [...factories].map(factory => {
      const key = _openWithKeyForFactory(factory.label || factory.name);
      const label = factory.label || factory.name;
      openWithCommands.push(app.commands.addCommand(key, {
        execute: args => Promise.all(Array.from(map(model.selection, item => app.commands.execute("docmanager:open", { path: Path.fromarray(item.row.path), ...args })))),
        label,
        isVisible: () => true,
      }));
      return openWith.addItem({
        args: { factory: factory.name, label: factory.label || factory.name },
        command: key,
      });
    });
  }
  app.contextMenu.opened.connect(updateOpenWithMenu);

  const selector = ".jp-tree-finder-sidebar";
  let contextMenuRank = 1;

  return [
    ...columnCommands,
    ...snippetCommands,

    // context menu items
    app.contextMenu.addItem({
      command: commandIDs.open,
      selector,
      rank: contextMenuRank++,
    }),
    app.contextMenu.addItem({
      type: "submenu",
      submenu: openWithMenu,
      selector,
      rank: contextMenuRank++,
    }),
    app.contextMenu.addItem({
      command: commandIDs.copy,
      selector,
      rank: contextMenuRank++,
    }),
    app.contextMenu.addItem({
      command: commandIDs.cut,
      selector,
      rank: contextMenuRank++,
    }),
    app.contextMenu.addItem({
      command: commandIDs.paste,
      selector,
      rank: contextMenuRank++,
    }),
    app.contextMenu.addItem({
      command: commandIDs.delete,
      selector,
      rank: contextMenuRank++,
    }),
    app.contextMenu.addItem({
      command: commandIDs.rename,
      selector,
      rank: contextMenuRank++,
    }),
    app.contextMenu.addItem({
      command: commandIDs.download,
      selector,
      rank: contextMenuRank++,
    }),
    app.contextMenu.addItem({
      type: "separator",
      selector,
      rank: contextMenuRank++,
    }),
    app.contextMenu.addItem({
      command: commandIDs.copyFullPath,
      selector,
      rank: contextMenuRank++,
    }),
    app.contextMenu.addItem({
      command: commandIDs.copyRelativePath,
      selector,
      rank: contextMenuRank++,
    }),
    app.contextMenu.addItem({
      type: "submenu",
      submenu: snippetsMenu,
      selector,
      rank: contextMenuRank++,
    }),
    app.contextMenu.addItem({
      type: "separator",
      selector,
      rank: contextMenuRank++,
    }),
    app.contextMenu.addItem({
      command: commandIDs.create_file,
      selector,
      rank: contextMenuRank++,
    }),
    app.contextMenu.addItem({
      command: commandIDs.create_folder,
      selector,
      rank: contextMenuRank++,
    }),
    app.contextMenu.addItem({
      type: "separator",
      selector,
      rank: contextMenuRank++,
    }),
    app.contextMenu.addItem({
      type: "submenu",
      submenu: columnsMenu,
      selector,
      rank: contextMenuRank++,
    }),
    app.contextMenu.addItem({
      args: { selection: true },
      command: commandIDs.refresh,
      selector,
      rank: contextMenuRank++,
    }),
  ].reduce((set: DisposableSet, d) => {
    set.add(d); return set;
  }, new DisposableSet());
}


export function getFactories(
  docRegistry: DocumentRegistry,
  widget: TreeFinderSidebar,
  item: Content<ContentsProxy.IJupyterContentRow>,
): DocumentRegistry.WidgetFactory[] {
  const path = [widget.url.trimEnd().replace(/\/+$/, ""), item.getPathAtDepth(1).join("/")].join("/");
  const factories = docRegistry.preferredWidgetFactories(path);
  const notebookFactory = docRegistry.getWidgetFactory("notebook");
  if (
    notebookFactory &&
    item.row.kind === "notebook" &&
    factories.indexOf(notebookFactory) === -1
  ) {
    factories.unshift(notebookFactory);
  }
  return factories;
}

function intersection<T>(iterables: Iterable<Iterable<T>>): Set<T> {
  let accumulator: Set<T> | undefined;
  for (const current of iterables) {
    // Initialize accumulator.
    if (accumulator === undefined) {
      accumulator = new Set(current);
      continue;
    }
    // Return early if empty.
    if (accumulator.size === 0) {
      return accumulator;
    }
    // Keep the intersection of accumulator and current.
    const intersection_set = new Set<T>();
    for (const value of current) {
      if (accumulator.has(value)) {
        intersection_set.add(value);
      }
    }
    accumulator = intersection_set;
  }
  return accumulator ?? new Set();
}
