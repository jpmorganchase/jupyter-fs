/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import { PageConfig, PathExt } from "@jupyterlab/coreutils";
import { Widget } from "@lumino/widgets";
import { saveAs } from "file-saver";
import JSZip from "jszip";


export const Patterns = {
  tree: new RegExp(`^${PageConfig.getOption("treeUrl")}([^?]+)`),
  workspace: new RegExp(`^${PageConfig.getOption("workspacesUrl")}[^?/]+/tree/([^?]+)`),
};

/**
 * Version of btoa that omits any "=" padding chars at the end
 */
export function btoaNopad(s: string): string {
  return btoa(s).replace(/=+$/, "");
}

export function createOpenNode(): HTMLElement {
  const body = document.createElement("div");
  const existingLabel = document.createElement("label");
  existingLabel.textContent = "File Path:";

  const input = document.createElement("input");
  input.value = "";
  input.placeholder = "/path/to/file";

  body.appendChild(existingLabel);
  body.appendChild(input);
  return body;
}

export function promptRename(
  text: HTMLElement,
  edit: HTMLInputElement,
  original: string
): Promise<string> {
  const parent = text.parentElement as HTMLElement;
  parent.replaceChild(edit, text);
  edit.focus();
  const index = edit.value.lastIndexOf('.');
  if (index === -1) {
    edit.setSelectionRange(0, edit.value.length);
  } else {
    edit.setSelectionRange(0, index);
  }

  return new Promise<string>((resolve, reject) => {
    edit.onblur = () => {
      parent.replaceChild(text, edit);
      resolve(edit.value);
    };
    edit.onkeydown = (event: KeyboardEvent) => {
      switch (event.keyCode) {
        case 13: // Enter
          event.stopPropagation();
          event.preventDefault();
          edit.blur();
          break;
        case 27: // Escape
          event.stopPropagation();
          event.preventDefault();
          edit.value = original;
          edit.blur();
          break;
        case 38: // Up arrow
          event.stopPropagation();
          event.preventDefault();
          if (edit.selectionStart !== edit.selectionEnd) {
            edit.selectionStart = edit.selectionEnd = 0;
          }
          break;
        case 40: // Down arrow
          event.stopPropagation();
          event.preventDefault();
          if (edit.selectionStart !== edit.selectionEnd) {
            edit.selectionStart = edit.selectionEnd = edit.value.length;
          }
          break;
        default:
          break;
      }
    };
  });
}

export function fileSizeString(fileBytes: number) {
  if (fileBytes == null) {
    return "";
  }
  if (fileBytes < 1024) {
    return fileBytes + " B";
  }

  let i = -1;
  const byteUnits = [" KB", " MB", " GB", " TB"];
  do {
    fileBytes = fileBytes / 1024;
    i++;
  } while (fileBytes > 1024);

  return Math.max(fileBytes, 0.1).toFixed(1) + byteUnits[i];
}

export function switchView(mode: any) {
  if (mode === "none") {
    return "";
  } else {
    return "none";
  }
}

export function writeZipFile(zip: JSZip, path: string) {
  zip.generateAsync({ type: "blob" }).then(content => {
    saveAs(content, PathExt.basename(path));
  });
}

export class OpenDirectWidget extends Widget {

  constructor() {
    super({ node: createOpenNode() });
  }

  getValue(): string {
    return this.inputNode.value;
  }

  get inputNode(): HTMLInputElement {
    return this.node.getElementsByTagName("input")[0];
  }
}
