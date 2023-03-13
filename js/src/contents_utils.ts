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
  if (path[0] !== contents.root.name) {
    throw new Error(`Path ${path} not in ${contents.root.pathstr}`);
  }
  let node = contents.root;
  for (let i=1; i<path.length; ++i) {
    if (!node.isExpand) {
      await node.expand();
    }
    // This is only for assertion purposes for the last iteration
    const children = await node.getChildren();
    const child = children.find(c => c.name === path[i]);
    if (!child) {
      throw new Error(`Path ${path} not in ${node.pathstr}`);
    }
    node = child;
  }
  return node;
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
export async function revealAndSelectPath<T extends IContentRow>(contents: ContentsModel<T>, path: string[], add?: boolean): Promise<Content<T>> {
  const node = await revealPath(contents, path);
  contents.selectionModel.select(node, add);
  return node;
}
