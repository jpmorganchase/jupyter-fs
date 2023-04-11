/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import { JupyterFrontEnd } from "@jupyterlab/application";
import {
  closeIcon,
  copyIcon,
  cutIcon,
  editIcon,
  filterListIcon,
  pasteIcon,
  refreshIcon,
  newFolderIcon,
} from "@jupyterlab/ui-components";
import { DisposableSet, IDisposable } from "@lumino/disposable";
import { Menu } from "@lumino/widgets";
import { Content, Path } from "tree-finder";


import { JupyterClipboard } from "./clipboard";
import { TreeFinderSidebar } from "./treefinder";
import type { IFSResource } from "./filesystem";
import type { ContentsProxy, TreeFinderTracker } from "./treefinder";
import { getContentParent, getRefreshTargets, revealAndSelectPath } from "./contents_utils";
import { ISettingRegistry } from "@jupyterlab/settingregistry";

// define the command ids as a constant tuple
export const commandNames = [
  "copy",
  "cut",
  "delete",
  "open",
  "paste",
  "refresh",
  "rename",
  "create_folder",
  "copyFullPath",
  "copyRelativePath",
  "toggleColumn-path",
  "toggleColumn",
];


export const commandIDs: CommandIDs = Object.fromEntries(commandNames.map(
  name => [name, `treefinder:${name}`]
));
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
    return selection.every((x: Content<ContentsProxy.IJupyterContentRow>) => x.row.writable)
  }
  return true
}

function toggleColumnCommandId(column: string): string {
  return `${commandIDs.toggleColumn}-${column}`;
}


function _getRelativePaths(selectedFiles: Content<ContentsProxy.IJupyterContentRow>[]): string[] {
  var allPaths: string[] = [];
  for (var file of selectedFiles) {
    let relativePath = file.getPathAtDepth(1).join('/');
    allPaths.push(relativePath);
  };
  return allPaths;
}


export function createCommands(
  app: JupyterFrontEnd,
  tracker: TreeFinderTracker,
  clipboard: JupyterClipboard,
  resources: IFSResource[],
  settings?: ISettingRegistry.ISettings,
): IDisposable {
  const selector = ".jp-tree-finder-sidebar";
  let submenu = new Menu({ commands: app.commands});
  submenu.title.label = 'Show/Hide Columns';
  submenu.title.icon = filterListIcon;
  submenu.addItem({ command: commandIDs.togglePath});
  for (let column of COLUMN_NAMES) {
    submenu.addItem({ command: toggleColumnCommandId(column) });
  }

  // const toggleState: {[key: string]: {[key: string]: boolean}} = {};
  // for (let resource of resources) {
  //   const colsToDisplay = resource.displayColumns as string[] ?? ['size'];
  //   const id = idFromResource(resource);
  //   toggleState[id] = {};
  //   const state = toggleState[id];
  //   for (let key of COLUMN_NAMES) {
  //     state[key] = colsToDisplay.includes(key);
  //   }
  // }
  const toggleState: {[key: string]: boolean} = {};
  const colsToDisplay = settings?.composite.display_columns as string[] ?? ['size'];
  for (let key of COLUMN_NAMES) {
    toggleState[key] = colsToDisplay.includes(key);
  }
    
  // globally accessible jupyter commands[
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
      execute: args => clipboard.model.deleteSelection(tracker.currentWidget!.treefinder.model!),
      icon: closeIcon.bindprops({ stylesheet: "menuItem" }),
      label: "Delete",
      isEnabled: () => currentWidgetSelectionIsWritable(tracker),
    }),
    app.commands.addCommand(commandIDs.open, {
      execute: args => tracker.currentWidget!.treefinder.model!.openSub.next(tracker.currentWidget!.treefinder.selection?.map(c => c.row)),
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
    app.commands.addCommand(commandIDs.create_folder, {
      execute: async args =>  {
        const widget = tracker.currentWidget!;
        const model = widget.treefinder.model!;
        let target = model.selectedLast ?? model.root;
        if (!target.hasChildren) {
          target = await getContentParent(target, model.root);
        }
        const path = Path.fromarray(target.row.path);
        const row = await widget.treefinder.contentsProxy.newUntitled({
          type: "directory",
          path,
        });
        target.invalidate();
        const content = await revealAndSelectPath(model, row.path);
        // Is this really needed?
        model.refreshSub.next(getRefreshTargets([target.row], model.root));
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
    app.commands.addCommand(commandIDs.refresh, {
      execute: args => {
        if (args["selection"]) {
          clipboard.refreshSelection(tracker.currentWidget!.treefinder.model!)
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
        const trimEnd = (path: string): string => {
          return path.trimEnd().replace(/\/+$/, ''); 
        };
        const fullPaths = _getRelativePaths(widget.treefinder.selection!).map(relativePath => [trimEnd(widget.url ?? ''), relativePath].join('/'));
        navigator.clipboard.writeText(fullPaths.join('\n'));
      },
      label: 'Copy Full Path',
      isEnabled: () => !!tracker.currentWidget,
    }),
    app.commands.addCommand(commandIDs.copyRelativePath, {
      execute: async args => {
        const widget = tracker.currentWidget!;
        const relativePaths = _getRelativePaths(widget.treefinder.selection!);
        navigator.clipboard.writeText(relativePaths.join('\n'));
      },
      label: 'Copy Relative Path',
      isEnabled: () => !!tracker.currentWidget,
    }),

    app.commands.addCommand(commandIDs.togglePath, {
      execute: args => {},
      label: 'path',
      isEnabled: () => false,
      isToggled: () => true,
    }),
    ...COLUMN_NAMES.map((column: keyof ContentsProxy.IJupyterContentRow) => {
      return app.commands.addCommand(toggleColumnCommandId(column), {
        execute: async args => {
          toggleState[column] = !toggleState[column];
          settings?.set("display_columns", COLUMN_NAMES.filter(k => toggleState[k]));
        },
        label: column,
        isToggleable: true,
        isToggled: () => {
          return toggleState[column];
        },
      })
    }),

    // context menu items
    app.contextMenu.addItem({
      command: commandIDs.open,
      selector,
      rank: 1,
    }),

    app.contextMenu.addItem({
      command: commandIDs.copy,
      selector,
      rank: 2,
    }),
    app.contextMenu.addItem({
      command: commandIDs.cut,
      selector,
      rank: 3,
    }),
    app.contextMenu.addItem({
      command: commandIDs.paste,
      selector,
      rank: 4,
    }),
    app.contextMenu.addItem({
      command: commandIDs.delete,
      selector,
      rank: 5,
    }),
    app.contextMenu.addItem({
      command: commandIDs.rename,
      selector,
      rank: 6,
    }),
    app.contextMenu.addItem({
      command: commandIDs.copyFullPath,
      selector,
      rank: 7,
    }),
    app.contextMenu.addItem({
      command: commandIDs.copyRelativePath,
      selector,
      rank: 8,
    }),
    app.contextMenu.addItem({
      type: 'submenu',
      submenu: submenu,
      selector,
      rank: 9,
    }),
    app.contextMenu.addItem({
      args: { selection: true },
      command: commandIDs.refresh,
      selector,
      rank: 10,
    }),
  ].reduce((set: DisposableSet, d) => {
    set.add(d); return set;
  }, new DisposableSet());;
}