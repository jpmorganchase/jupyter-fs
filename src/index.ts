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
import { PageConfig } from "@jupyterlab/coreutils";
import { IDocumentManager } from "@jupyterlab/docmanager";
import { ISettingRegistry } from "@jupyterlab/settingregistry";
import { DisposableSet } from "@lumino/disposable";

import { constructFileTreeWidget } from "./filetree";

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
  // Attempt to load application settings
  let settings: ISettingRegistry.ISettings;
  try {
    settings = await settingRegistry.load(plugin.id);
  } catch (error) {
    // tslint:disable-next-line:no-console
    console.warn(`Failed to load settings for the jupyter-fs extension.\n${error}`);
  }

  // grab templates from serverextension
  function ftFromServerextension(disposable: DisposableSet) {
    fetch(new Request(PageConfig.getBaseUrl() + "multicontents/get", {method: "get"})).then(async (val) => {
      if (val.ok) {
        const keys = await val.json() as string[];

        // tslint:disable-next-line:no-console
        console.log("JupyterLab extension jupyter-fs is activated!");
        for ( const s of keys) {
          disposable.add(constructFileTreeWidget(app, s, s, "left", paths, resolver, restorer, manager, router));
          // tslint:disable-next-line:no-console
          console.log("Adding contents manager for " + s);
        }
      } else {
        // tslint:disable-next-line:no-console
        console.warn("jupyter-fs failed to activate");
      }
    });
  }

  const _d = new DisposableSet();
  if (settings) {
    function onSettingsChange(settings: ISettingRegistry.ISettings) {
      _d.dispose();

      ftFromServerextension(_d);
    }

    settings.changed.connect(onSettingsChange, this);
  }
}

export default plugin;
export {activate as _activate};
