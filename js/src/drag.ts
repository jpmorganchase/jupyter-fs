/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

/*
Originally copied from jupyter's nbdime package, under the following license terms:

This project is licensed under the terms of the Modified BSD License
(also known as New or Revised or 3-Clause BSD), as follows:

- Copyright (c) 2001-2015, IPython Development Team
- Copyright (c) 2015-, Jupyter Development Team

All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, this
list of conditions and the following disclaimer.

Redistributions in binary form must reproduce the above copyright notice, this
list of conditions and the following disclaimer in the documentation and/or
other materials provided with the distribution.

Neither the name of the Jupyter Development Team nor the names of its
contributors may be used to endorse or promote products derived from this
software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

## About the Jupyter Development Team

The Jupyter Development Team is the set of all contributors to the Jupyter project.
This includes all of the Jupyter subprojects.

The core team that coordinates development on GitHub can be found here:
https://github.com/jupyter/.
*/

"use strict";

import {
  Widget,
} from "@lumino/widgets";

import type {
  Message,
} from "@lumino/messaging";

import {
  MimeData,
} from "@lumino/coreutils";

import {
  Drag,
} from "@lumino/dragdrop";


/**
 * The class name added to the DropWidget
 */
const DROP_WIDGET_CLASS = "jfs-DropWidget";

/**
 * The class name added to the DragWidget
 */
const DRAG_WIDGET_CLASS = "jfs-DragWidget";

/**
 * The class name added to something which can be used to drag a box
 */
const DRAG_HANDLE = "jfs-mod-dragHandle";

/**
 * The class name of the default drag handle
 */
const DEFAULT_DRAG_HANDLE_CLASS = "jfs-DragWidget-dragHandle";

/**
 * The class name added to a drop target.
 */
const DROP_TARGET_CLASS = "jfs-mod-dropTarget";

/**
 * The threshold in pixels to start a drag event.
 */
const DRAG_THRESHOLD = 5;

/**
 * The mime type for a table header drag object.
 */
export const TABLE_HEADER_MIME = "application/x-jupyterfs-thead";


/**
 * Determine whether node is equal to or a descendant of our widget, and that it does
 * not belong to a nested drag widget.
 */
export
function belongsToUs(node: HTMLElement, parentClass: string,
  parentNode: HTMLElement): boolean {
  let candidate: HTMLElement | null = node;
  // Traverse DOM until drag widget encountered:
  while (candidate && !candidate.classList.contains(parentClass)) {
    candidate = candidate.parentElement;
  }
  return !!candidate && candidate === parentNode;
}


/**
 * Find the direct child node of `parent`, which has `node` as a descendant.
 * Alternatively, parent can be a collection of children.
 *
 * Returns null if not found.
 */
export
function findChild(parent: HTMLElement | HTMLElement[], node: HTMLElement): HTMLElement | null  {
  // Work our way up the DOM to an element which has this node as parent
  const parentIsArray = Array.isArray(parent);
  const isDirectChild = (element: HTMLElement): boolean => {
    if (parentIsArray) {
      return parent.indexOf(element) > -1;
    } else {
      return element.parentElement === parent;
    }
  };
  let candidate: HTMLElement | null = node;
  let child: HTMLElement | null = null;
  while (candidate && candidate !== parent) {
    if (isDirectChild(candidate)) {
      child = candidate;
      break;
    }
    candidate = candidate.parentElement;
  }
  return child;
}


/**
 * A widget class which allows the user to drop mime data onto it.
 *
 * To complete the class, the following functions need to be implemented:
 *  - processDrop: Process pre-screened drop events
 *
 * The functionallity of the class can be extended by overriding the following
 * functions:
 *  - findDropTarget(): Override if anything other than the direct children
 *    of the widget's node are to be the drop targets.
 *
 * For maximum control, `evtDrop` can be overriden.
 */
export
abstract class DropWidget extends Widget {
  /**
   * Construct a drop widget.
   */
  constructor(options: DropWidget.IOptions={}) {
    super(options);
    this.acceptDropsFromExternalSource =
      options.acceptDropsFromExternalSource === true;
    this.addClass(DROP_WIDGET_CLASS);
    this.acceptedDropMimeTypes = options.acceptedDropMimeTypes ?? [];
  }

  /**
   * Whether the widget should accept drops from an external source,
   * or only accept drops from itself.
   * Defaults to false, which will disallow all drops unless widget
   * is also a drag widget.
   */
  acceptDropsFromExternalSource: boolean;


  /**
   * Which mimetypes that the widget accepts for drops
   */
  acceptedDropMimeTypes: string[];


  /**
   * Handle the DOM events for the widget.
   *
   * @param event - The DOM event sent to the widget.
   *
   * #### Notes
   * This method implements the DOM `EventListener` interface and is
   * called in response to events on the drop widget's node. It should
   * not be called directly by user code.
   */
  handleEvent(event: Event): void {
    switch (event.type) {
      case "lm-dragenter":
        this._evtDragEnter(event as Drag.Event);
        break;
      case "lm-dragleave":
        this._evtDragLeave(event as Drag.Event);
        break;
      case "lm-dragover":
        this._evtDragOver(event as Drag.Event);
        break;
      case "lm-drop":
        this.evtDrop(event as Drag.Event);
        break;
      default:
        break;
    }
  }

  protected validateSource(event: Drag.Event) {
    return this.acceptDropsFromExternalSource || event.source === this;
  }

  /**
   * Processes a drop event.
   *
   * This function is called after checking:
   *  - That the `dropTarget` is a valid drop target
   *  - The value of `event.source` if `acceptDropsFromExternalSource` is false
   */
  protected abstract processDrop(dropTarget: HTMLElement, event: Drag.Event): void;

  /**
   * Find a drop target from a given drag event target.
   *
   * Returns null if no valid drop target was found.
   *
   * The default implementation returns the direct child that is the parent of
   * `node`, or `node` if it is itself a direct child. It also checks that the
   * needed mime type is included
   */
  protected findDropTarget(input: HTMLElement, mimeData: MimeData): HTMLElement | null  {
    if (!this.acceptedDropMimeTypes.some(mimetype => mimeData.hasData(mimetype))) {
      return null;
    }

    if (this._isValidTargetHeader(input, mimeData.getData(TABLE_HEADER_MIME) as string)) {
      input.classList.add(DROP_TARGET_CLASS);
    } else {
      return null;
    }

    // No need to findChild for reordering of columns
    if (mimeData.types().includes(TABLE_HEADER_MIME)) {
      return input;
    } else {
      return findChild(this.node, input);
    }
  }

  /**
   * Handle the `'lm-drop'` event for the widget.
   *
   * Responsible for pre-processing event before calling `processDrop`.
   *
   * Should normally only be overriden if you cannot achive your goal by
   * other overrides.
   */
  protected evtDrop(event: Drag.Event): void {
    let target = event.target as HTMLElement;
    while (target && target.parentElement) {
      if (target.classList.contains(DROP_TARGET_CLASS)) {
        target.classList.remove(DROP_TARGET_CLASS);
        break;
      }
      target = target.parentElement;
    }
    if (!target || !belongsToUs(target, DROP_WIDGET_CLASS, this.node)) {
      // Ignore event
      return;
    }

    // If configured to, only accept internal moves:
    if (!this.validateSource(event)) {
      event.dropAction = "none";
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    this.processDrop(target, event);
  }

  /**
   * Handle `after_attach` messages for the widget.
   */
  protected onAfterAttach(msg: Message): void {
    const node = this.node;
    node.addEventListener("lm-dragenter", this);
    node.addEventListener("lm-dragleave", this);
    node.addEventListener("lm-dragover", this);
    node.addEventListener("lm-drop", this);
  }

  /**
   * Handle `before_detach` messages for the widget.
   */
  protected onBeforeDetach(msg: Message): void {
    const node = this.node;
    node.removeEventListener("lm-dragenter", this);
    node.removeEventListener("lm-dragleave", this);
    node.removeEventListener("lm-dragover", this);
    node.removeEventListener("lm-drop", this);
  }


  /**
   * Handle the `'lm-dragenter'` event for the widget.
   */
  private _evtDragEnter(event: Drag.Event): void {
    if (!this.validateSource(event)) {
      return;
    }
    const target = this.findDropTarget(event.target as HTMLElement, event.mimeData);
    if (target === null) {
      return;
    }
    this._clearDropTarget();
    target.classList.add(DROP_TARGET_CLASS);
    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * Handle the `'lm-dragleave'` event for the widget.
   */
  private _evtDragLeave(event: Drag.Event): void {
    event.preventDefault();
    event.stopPropagation();
    this._clearDropTarget();
  }

  /**
   * Handle the `'lm-dragover'` event for the widget.
   */
  private _evtDragOver(event: Drag.Event): void {
    if (!this.validateSource(event)) {
      return;
    }
    this._clearDropTarget();
    const target = this.findDropTarget(event.target as HTMLElement, event.mimeData);
    if (target === null) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dropAction = event.proposedAction;
  }

  /**
   * Checks if the target is a header, and it is not 'path' or itself
   */
  private _isValidTargetHeader(target: HTMLElement, draggedColumn: string) {
    return target.classList.contains("tf-header-name") &&
            target.innerText !== draggedColumn &&
            target.innerText !== "path";
  }

  /**
   * Clear existing drop target from out children.
   *
   * #### Notes
   * This function assumes there are only one active drop target
   */
  private _clearDropTarget(): void {
    const elements = this.node.getElementsByClassName(DROP_TARGET_CLASS);
    if (elements.length) {
      (elements[0] as HTMLElement).classList.remove(DROP_TARGET_CLASS);
    }
  }
}

/**
 * An internal base class for implementing drag operations on top
 * of drop class.
 */
export
abstract class DragDropWidgetBase extends DropWidget {

  /**
   * Construct a drag and drop base widget.
   */
  constructor(options: DragDropWidget.IOptions={}) {
    super(options);
    this.addClass(DRAG_WIDGET_CLASS);
  }

  /**
   * Dispose of the resources held by the directory listing.
   */
  dispose(): void {
    this.drag = null;
    this._clickData = null;
    super.dispose();
  }

  /**
   * Handle the DOM events for the widget.
   *
   * @param event - The DOM event sent to the widget.
   *
   * #### Notes
   * This method implements the DOM `EventListener` interface and is
   * called in response to events on the drag widget's node. It should
   * not be called directly by user code.
   */
  handleEvent(event: Event): void {
    switch (event.type) {
      case "mousedown":
        this._evtDragMousedown(event as MouseEvent);
        break;
      case "mouseup":
        this._evtDragMouseup(event as MouseEvent);
        break;
      case "mousemove":
        this._evtDragMousemove(event as MouseEvent);
        break;
      default:
        super.handleEvent(event);
        break;
    }
  }

  /**
   * Adds mime data representing the drag data to the drag event's MimeData bundle.
   */
  protected abstract addMimeData(handle: HTMLElement, mimeData: MimeData): void;

  /**
   * Finds the drag target (the node to move) from a drag handle.
   *
   * Returns null if no valid drag target was found.
   *
   * The default implementation returns the handle directly.
   */
  protected findDragTarget(handle: HTMLElement): HTMLElement | null {
    return handle;
  }

  /**
   * Returns the drag image to use when dragging using the given handle.
   *
   * The default implementation returns a clone of the drag target.
   */
  protected getDragImage(handle: HTMLElement): HTMLElement | null {
    const target = this.findDragTarget(handle);
    if (target) {
      return target.cloneNode(true) as HTMLElement;
    }
    return null;
  }

  /**
   * Called when a drag has completed with this widget as a source
   */
  protected onDragComplete(action: Drag.DropAction) {
    this.drag = null;
  }

  /**
   * Handle `after_attach` messages for the widget.
   */
  protected onAfterAttach(msg: Message): void {
    const node = this.node;
    node.addEventListener("mousedown", this);
    super.onAfterAttach(msg);
  }

  /**
   * Handle `before_detach` messages for the widget.
   */
  protected onBeforeDetach(msg: Message): void {
    const node = this.node;
    node.removeEventListener("click", this);
    node.removeEventListener("dblclick", this);
    document.removeEventListener("mousemove", this, true);
    document.removeEventListener("mouseup", this, true);
    super.onBeforeDetach(msg);
  }

  /**
   * Start a drag event.
   *
   * Called when dragging and DRAG_THRESHOLD is met.
   *
   * Should normally only be overriden if you cannot achieve your goal by
   * other overrides.
   */
  protected startDrag(handle: HTMLElement, clientX: number, clientY: number): void {
    // Create the drag image.
    const dragImage = this.getDragImage(handle);

    // Set up the drag event.
    this.drag = new Drag({
      dragImage: dragImage || undefined,
      mimeData: new MimeData(),
      supportedActions: this.defaultSupportedActions,
      proposedAction: this.defaultProposedAction,
      source: this,
    });
    this.addMimeData(handle, this.drag.mimeData);

    // Start the drag and remove the mousemove listener.
    void this.drag.start(clientX, clientY).then(action => this.onDragComplete(action));
    document.removeEventListener("mousemove", this, true);
    document.removeEventListener("mouseup", this, true);
  }

  /**
   * Drag data stored in _startDrag
   */
  protected drag: Drag | null = null;

  protected dragHandleClass = DRAG_HANDLE;

  /**
   * Check if node, or any of nodes ancestors are a drag handle
   *
   * If it is a drag handle, it returns the handle, if not returns null.
   */
  private _findDragHandle(node: HTMLElement): HTMLElement | null {
    let handle: HTMLElement | null = null;
    // Traverse up DOM to check if click is on a drag handle
    let candidate: HTMLElement | null = node;
    while (candidate && candidate !== this.node) {
      if (candidate.classList.contains(this.dragHandleClass)) {
        handle = candidate;
        break;
      }
      candidate = candidate.parentElement;
    }
    // Finally, check that handle does not belong to a nested drag widget
    if (handle !== null && !belongsToUs(
      handle, DRAG_WIDGET_CLASS, this.node)) {
      // Handle belongs to a nested drag widget:
      handle = null;
    }
    return handle;
  }

  /**
   * Handle the `'mousedown'` event for the widget.
   */
  private _evtDragMousedown(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const handle = this._findDragHandle(target);
    if (handle === null) {
      return;
    }

    // Left mouse press for drag start.
    if (event.button === 0) {
      this._clickData = { pressX: event.clientX, pressY: event.clientY,
        handle };
      document.addEventListener("mouseup", this, true);
      document.addEventListener("mousemove", this, true);
      event.preventDefault();
    }
  }


  /**
   * Handle the `'mouseup'` event for the widget.
   */
  private _evtDragMouseup(event: MouseEvent): void {
    if (event.button !== 0 || !this.drag) {
      document.removeEventListener("mousemove", this, true);
      document.removeEventListener("mouseup", this, true);
      this.drag = null;
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * Handle the `'mousemove'` event for the widget.
   */
  private _evtDragMousemove(event: MouseEvent): void {
    // Bail if we are already dragging.
    if (this.drag) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    // Check for a drag initialization.
    const data = this._clickData;
    if (!data) {
      throw new Error("Missing drag data");
    }
    const dx = Math.abs(event.clientX - data.pressX);
    const dy = Math.abs(event.clientY - data.pressY);
    if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) {
      return;
    }

    this.startDrag(data.handle, event.clientX, event.clientY);
    this._clickData = null;
  }

  protected defaultSupportedActions: Drag.SupportedActions = "all";
  protected defaultProposedAction: Drag.DropAction = "move";

  /**
   * Data stored on mouse down to determine if drag treshold has
   * been overcome, and to initialize drag once it has.
   */
  private _clickData: { pressX: number, pressY: number, handle: HTMLElement } | null = null;
}

/**
 * A widget which allows the user to initiate drag operations.
 *
 * Any descendant element with the drag handle class `'jfs-mod-dragHandle'`
 * will serve as a handle that can be used for dragging. If DragWidgets are
 * nested, handles will only belong to the closest parent DragWidget. For
 * convenience, the functions `makeHandle`, `unmakeHandle` and
 * `createDefaultHandle` can be used to indicate which elements should be
 * made handles. `createDefaultHandle` will create a new element as a handle
 * with a default styling class applied. Optionally, `childrenAreDragHandles`
 * can be set to indicate that all direct children are themselve drag handles.
 *
 * To complete the class, the following functions need to be implemented:
 * - addMimeData: Adds mime data to new drag events
 *
 * The functionallity of the class can be extended by overriding the following
 * functions:
 *  - findDragTarget(): Override if anything other than the direct children
 *    of the widget's node are to be drag targets.
 *  - getDragImage: Override to change the drag image (the default is a
 *    copy of the drag target).
 *  - onDragComplete(): Callback on drag source when a drag has completed.
 */
export
abstract class DragWidget extends DragDropWidgetBase {
  /**
   * Construct a drag widget.
   */
  constructor(options: DragWidget.IOptions={}) {
    // Implementation removes DropWidget options
    super(options);
  }

  /**
   * No-op on DragWidget, as it does not support dropping
   */
  protected processDrop(dropTarget: HTMLElement, event: Drag.Event): void {
    // Intentionally empty
  }

  /**
   * Simply returns null for DragWidget, as it does not support dropping
   */
  protected findDropTarget(input: HTMLElement, mimeData: MimeData): HTMLElement | null {
    return null;
  }

}


/**
 * A widget which allows the user to rearrange widgets in the widget by
 * drag and drop. An internal drag and drop of a widget will cause it
 * to be inserted (by `insertWidget`) in the index of the widget it was
 * dropped on.
 *
 * Any descendant element with the drag handle class `'jfs-mod-dragHandle'`
 * will serve as a handle that can be used for dragging. If DragWidgets are
 * nested, handles will only belong to the closest parent DragWidget. For
 * convenience, the functions `makeHandle`, `unmakeHandle` and
 * `createDefaultHandle` can be used to indicate which elements should be
 * made handles. `createDefaultHandle` will create a new element as a handle
 * with a default styling class applied. Optionally, `childrenAreDragHandles`
 * can be set to indicate that all direct children are themselve drag handles.
 *
 * The functionallity of the class can be extended by overriding the following
 * functions:
 *  - addMimeData: Override to add other drag data to the mime bundle.
 *    This is often a necessary step for allowing dragging to external
 *    drop targets.
 *  - processDrop: Override if you need to handle other mime data than the
 *    default. For allowing drops from external sources, the field
 *    `acceptDropsFromExternalSource` should be set as well.
 *  - findDragTarget(): Override if anything other than the direct children
 *    of the widget's node are to be drag targets.
 *  - findDropTarget(): Override if anything other than the direct children
 *    of the widget's node are to be the drop targets.
 *  - getIndexOfChildNode(): Override to change the key used to represent
 *    the drag and drop target (default is index of child widget).
 *  - move(): Override to change how a move is handled.
 *  - getDragImage: Override to change the drag image (the default is a
 *    copy of the drag target).
 *  - onDragComplete(): Callback on drag source when a drag has completed.
 *
 * To drag and drop other things than all direct children, the following functions
 * should be overriden: `findDragTarget`, `findDropTarget` and possibly
 * `getIndexOfChildNode` and `move` to allow for custom to/from keys.
 *
 * For maximum control, `startDrag` and `evtDrop` can be overriden.
 */
export abstract class DragDropWidget extends DragDropWidgetBase {
  protected abstract move(mimeData: MimeData, target: HTMLElement): Drag.DropAction;

  /**
   * Adds mime data represeting the drag data to the drag event's MimeData bundle.
   *
   * The default implementation adds mime data indicating the index of the direct
   * child being dragged (as indicated by findDragTarget).
   *
   * Override this method if you have data that cannot be communicated well by an
   * index, for example if the data should be able to be dropped on an external
   * target that only understands direct mime data.
   *
   * As the method simply adds mime data for a specific key, overriders can call
   * this method before/after adding their own mime data to still support default
   * dragging behavior.
   */
  protected abstract addMimeData(handle: HTMLElement, mimeData: MimeData): void;

  /**
   * Processes a drop event.
   *
   * This function is called after checking:
   *  - That the `dropTarget` is a valid drop target
   *  - The value of `event.source` if `acceptDropsFromExternalSource` is false
   *
   * The default implementation assumes calling `getIndexOfChildNode` with
   * `dropTarget` will be valid. It will call `move` with that index as `to`,
   * and the index stored in the mime data as `from`.
   *
   * Override this if you need to handle other mime data than the default.
   */
  protected processDrop(dropTarget: HTMLElement, event: Drag.Event): void {
    if (!DropWidget.isValidAction(event.supportedActions, "move") ||
        event.proposedAction === "none") {
      // The default implementation only handles move action
      // OR Accept proposed none action, and perform no-op
      event.dropAction = "none";
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!this.validateSource(event)) {
      // Source indicates external drop, incorrect use in subclass
      throw new Error("Invalid source!");
    }

    // We have an acceptable drop, handle:
    const action = this.move(event.mimeData, dropTarget);
    event.preventDefault();
    event.stopPropagation();
    event.dropAction = action;
  }
}


/**
 * The namespace for the `DropWidget` class statics.
 */
export
namespace DropWidget {
  /**
   * An options object for initializing a drag widget widget.
   */
  export
  interface IOptions extends Widget.IOptions {
    /**
     * Whether the lsit should accept drops from an external source.
     * Defaults to false.
     *
     * This option only makes sense to set for subclasses that accept drops from
     * external sources.
     */
    acceptDropsFromExternalSource?: boolean;

    /**
     * Which mimetypes are acceptable for drops
     */
    acceptedDropMimeTypes?: string[];
  }

  /**
   * Validate a drop action against a SupportedActions type
   */
  export
  function isValidAction(supported: Drag.SupportedActions, action: Drag.DropAction): boolean {
    switch (supported) {
      case "all":
        return true;
      case "link-move":
        return action === "move" || action === "link";
      case "copy-move":
        return action === "move" || action === "copy";
      case "copy-link":
        return action === "link" || action === "copy";
      default:
        return action === supported;
    }
  }
}

/**
 * The namespace for the `DragWidget` class statics.
 */
export
namespace DragWidget {
  /**
   * An options object for initializing a drag widget widget.
   */
  export
  interface IOptions extends Widget.IOptions {
  }

  /**
   * Mark a widget as a drag handle.
   *
   * Using this, any child-widget can be a drag handle, as long as mouse events
   * are propagated from it to the DragWidget.
   */
  export
  function makeHandle(handle: Widget) {
    handle.addClass(DRAG_HANDLE);
  }

  /**
   * Unmark a widget as a drag handle
   */
  export
  function unmakeHandle(handle: Widget) {
    handle.removeClass(DRAG_HANDLE);
  }

  /**
   * Create a default handle widget for dragging (see styling in DragWidget.css).
   *
   * The handle will need to be styled to ensure a minimum size
   */
  export
  function createDefaultHandle(): Widget {
    const widget = new Widget();
    widget.addClass(DEFAULT_DRAG_HANDLE_CLASS);
    makeHandle(widget);
    return widget;
  }
}


/**
 * The namespace for the `DragDropWidget` class statics.
 */
export
namespace DragDropWidget {
  export
  interface IOptions extends DragWidget.IOptions, DropWidget.IOptions {
  }
}
