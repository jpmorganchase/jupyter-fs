import { PromiseDelegate } from "@lumino/coreutils";

import * as React from "react";
import * as ReactDOM from "react-dom";

import { askRequired, AskDialog } from "./auth";
import { FSComm, IFSResource, IFSOptions } from "./filesystem";


/**
 * Init resource on the server, and prompt for credentials via a dialog if needed.
 *
 * @param resources The resources to initialize to.
 * @param options The initialization options to use.
 * @returns All resources, whether inited or not
 */
export async function initResources(resources: IFSResource[], options: IFSOptions): Promise<IFSResource[]> {
  const delegate = new PromiseDelegate<IFSResource[]>();
  // send user specs to backend; await return containing resources
  // defined by user settings + resources defined by server config
  resources = await FSComm.instance.initResourceRequest({
    resources,
    options: {
      ...options,
      _addServerside: true,
    },
  });

  if (askRequired(resources)) {
    // ask for url template values, if required
    const dialogElem = document.createElement("div");
    document.body.appendChild(dialogElem);

    let submitted = false;
    const handleClose = () => {
      try {
        ReactDOM.unmountComponentAtNode(dialogElem);
        dialogElem.remove();
        if (!submitted) {
          delegate.resolve(resources);
        }
      } catch (e) {
        delegate.reject(e);
      }
    };

    const handleSubmit = async (values: {[url: string]: {[key: string]: string}}) => {
      try {
        submitted = true;
        resources = await FSComm.instance.initResourceRequest({
          resources: resources.map(r => ({ ...r, tokenDict: values[r.url] })),
          options,
        });
        delegate.resolve(resources);
      } catch (e) {
        delegate.reject(e);
      }
    };

    ReactDOM.render(
      <AskDialog
        handleClose={handleClose}
        handleSubmit={handleSubmit}
        options={options}
        resources={resources}
      />,
      dialogElem,
    );

  } else {
    delegate.resolve(resources);
  }
  return delegate.promise;
}
