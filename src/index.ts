/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */
import { ILayoutRestorer, IRouter, JupyterFrontEnd, JupyterFrontEndPlugin } from "@jupyterlab/application";
import { IWindowResolver } from "@jupyterlab/apputils";
import { IDocumentManager } from "@jupyterlab/docmanager";
import { ISettingRegistry } from "@jupyterlab/settingregistry";
import { DisposableSet } from "@lumino/disposable";

import { FSComm, IFSResourceSpec } from "./filesystem";
import { FileTree } from "./filetree";

// tslint:disable: variable-name

const plugin: JupyterFrontEndPlugin<void> = {
  activate,
  autoStart: true,
  id: "jupyter-fs:plugin",
  requires: [
    IDocumentManager,
    JupyterFrontEnd.IPaths,
    IWindowResolver,
    ILayoutRestorer,
    IRouter,
    ISettingRegistry,
  ],
};

async function activate(
  app: JupyterFrontEnd,
  manager: IDocumentManager,
  paths: JupyterFrontEnd.IPaths,
  resolver: IWindowResolver,
  restorer: ILayoutRestorer,
  router: IRouter,
  settingRegistry: ISettingRegistry,
) {
  const comm = new FSComm();
  let disposable = new DisposableSet();
  const sidebarProps: FileTree.ISidebarProps = {
    app,
    manager,
    paths,
    resolver,
    restorer,
    router
  };

  // Attempt to load application settings
  let settings: ISettingRegistry.ISettings;
  try {
    settings = await settingRegistry.load(plugin.id);
  } catch (error) {
    // tslint:disable-next-line:no-console
    console.warn(`Failed to load settings for the jupyter-fs extension.\n${error}`);
  }

  async function refresh() {
    // each disposable can only be disposed once
    disposable.dispose();
    disposable = new DisposableSet();

    // get user settings from json file
    const specs: IFSResourceSpec[] = settings.composite["specs"] as any;
    const verbose: boolean = settings.composite["verbose"] as any;

    // send user specs to backend; await return containing resources
    // defined by user settings + resources defined by server config
    const resources = await comm.initResourceRequest(...specs);

    if (verbose) {
      // tslint:disable-next-line:no-console
      console.info(`jupyter-fs frontend received resources:\n${resources}`);
    }

    // create the fs resource frontends (ie FileTree instances)
    for (const r of resources) {
      // make one composite disposable for all fs resource frontends
      disposable.add(FileTree.sidebarFromResource(r, sidebarProps));
    }
  }

  if (settings) {
    // initial setup
    refresh();

    // rerun setup whenever relevant settings change
    settings.changed.connect(refresh);
  }
}

export default plugin;
export {activate as _activate};
