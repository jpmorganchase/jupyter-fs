/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */
import {ILayoutRestorer, IRouter, JupyterFrontEnd, JupyterFrontEndPlugin} from "@jupyterlab/application";
import {IWindowResolver} from "@jupyterlab/apputils";
import {PageConfig} from "@jupyterlab/coreutils";
import {IDocumentManager} from "@jupyterlab/docmanager";
import {constructFileTreeWidget} from "./filetree";

import "../style/index.css";

// tslint:disable: variable-name

const extension: JupyterFrontEndPlugin<void> = {
  activate,
  autoStart: true,
  id: "jupyterfs",
  requires: [JupyterFrontEnd.IPaths, IWindowResolver, ILayoutRestorer, IDocumentManager, IRouter],
};

function activate(app: JupyterFrontEnd,
                  paths: JupyterFrontEnd.IPaths,
                  resolver: IWindowResolver,
                  restorer: ILayoutRestorer,
                  manager: IDocumentManager,
                  router: IRouter) {

  // grab templates from serverextension
  fetch(new Request(PageConfig.getBaseUrl() + "multicontents/get",
                    {method: "get"})).then(async (value: Response) => {
    if (value.ok) {
      const keys = await value.json() as string[];

      // tslint:disable-next-line:no-console
      console.log("JupyterLab extension jupyterfs is activated!");
      for ( const s of keys) {
        constructFileTreeWidget(app, s, s, "left", paths, resolver, restorer, manager, router);
        // tslint:disable-next-line:no-console
        console.log("Adding contents manager for " + s);
      }
    } else {
      // tslint:disable-next-line:no-console
      console.warn("Jupyter-fs failed to activate");
    }
  });
}

export default extension;
export {activate as _activate};
