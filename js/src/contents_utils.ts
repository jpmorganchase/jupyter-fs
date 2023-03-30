/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import { Content, ContentsModel, IContentRow } from "tree-finder";

/**
 * Utilities for manipulating the tree-finder contents model
 */


async function* walkPath<T extends IContentRow>(path: string[], root: Content<T>) {
    // Walk the path from the root
    if (path[0] !== root.name) {
      throw new Error(`Path ${path.join('/')} not in ${root.pathstr}`);
    }
    let node = root;
    yield node;
    for (let i=1; i<path.length; ++i) {
      const children = await node.getChildren();
      const child = children?.find(c => c.name === path[i]);
      if (!child) {
        throw new Error(`Path ${path.join('/')} not in ${node.pathstr}`);
      }
      node = child;
      yield node;
    }
}


/**
 * Expand the contents nodes until path is exposed.
 * 
 * This means that even if the final element of the path is a directory, its expanded state will
 * not change.
 * 
 * @param contents The contents model that the path is in
 * @param path The path to expose, relative to the root (i.e. first entry matches path of root)
 */
export async function revealPath<T extends IContentRow>(contents: ContentsModel<T>, path: string[]): Promise<Content<T>> {
  let node: Content<T>;
  for await (node of walkPath(path, contents.root)) {
    if (!node.isExpand && node.hasChildren) {
      await node.expand();
    }
  }
  return node!;
}


/**
 * Expand the contents nodes until path is exposed, and select the node of that path.
 * 
 * This means that even if the final element of the path is a directory, its expanded state will
 * not change.
 * 
 * @param contents The contents model that the path is in
 * @param path The path to expose, relative to the root (i.e. first entry matches path of root)
 * @param add Whether or not to add the path to the current selection, or to replace the current selection @see TreeFinder.SelectionModel.select
 */
export async function revealAndSelectPath<T extends IContentRow>(contents: ContentsModel<T>, path: string[], add?: boolean): Promise<Content<T>> {
  const node = await revealPath(contents, path);
  contents.selectionModel.select(node, add);
  return node;
}

/**
 * This will cause contents API calls if any dir has been invalidated between root and the parent.
 * 
 * @param child The content node's whose parent we are looking for
 * @param root The root node of the path
 */
export async function getContentParent<T extends IContentRow>(child: Content<T>, root: Content<T>) {
  // Walk from the root to the parent
  let node: Content<T>;
  for await (node of walkPath(child.row.path.slice(0, -1), root)) {
  }
  return node!;
}
