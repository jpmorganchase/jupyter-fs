/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { Content, ContentsModel, IContentRow } from "@tree-finder/base";

/**
 * Utilities for manipulating the tree-finder contents model
 */

/**
 * Walk the path from root, yielding all rows along the way
 *
 * @param path The path to walk to
 * @param root The root to start from
 */
async function* walkPath<T extends IContentRow>(path: string[], root: Content<T>) {
  // Walk the path from the root
  const pathstr = path.join("/");
  if (!pathstr.startsWith(root.pathstr)) {
    throw new Error(`Path ${pathstr} not in ${root.pathstr}`);
  }
  let node = root;
  yield node;
  for (let i=root.row.path.length; i<path.length; ++i) {
    const children = await node.getChildren();
    const child = children?.find(c => c.name === path[i]);
    if (!child) {
      throw new Error(`Path ${pathstr} not in ${node.pathstr}`);
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
  const promises: Array<Promise<void>> = [];
  for await (node of walkPath(path, contents.root)) {
    if (!node.isExpand && node.hasChildren) {
      promises.push(node.expand());
    }
  }
  await Promise.all(promises);
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
 * Recursively opens directories in a contents model
 *
 * @param model The contents model where directories are to be opened
 * @param path Array of directory names to be opened in order
 */
export async function openDirRecursive<T extends IContentRow>(model: ContentsModel<T>, path: string[]) {
  const promises: Array<Promise<void>> = [];
  for await (const node of walkPath(path, model.root)) {
    if (node.pathstr !== model.root.pathstr) {
      promises.push(model.openDir(node.row));
    }
  }
  await Promise.all(promises);
}


/**
 * Get the parent contents row for the given contents row.
 *
 * Note: This will cause contents API calls if any dir has been invalidated between root and the parent.
 *
 * @param child The content node's whose parent we are looking for
 * @param root The root node of the path
 */
export async function getContentParent<T extends IContentRow>(child: Content<T>, root: Content<T>) {
  // Walk from the root to the parent
  let node: Content<T>;
  for await (node of walkPath(child.row.path.slice(0, -1), root)) {
    // no-op
  }
  return node!;
}


/**
 * Get targets to use for a call to tree-finder's refresh
 *
 * @param invalidateTargets The targets that need to be refreshed
 * @param root The root node of the contents tree
 * @param targetParents Whether the parents are the ones that should be invalidated
 * @returns
 */
export function getRefreshTargets<T extends IContentRow>(
  invalidateTargets: T[],
  root: Content<T>,
  targetParents=false
): T[] | undefined {
  const rootRefreshThreshold = root.row.path.length + (targetParents ? 1 : 0);
  const rootNeedsRefresh = invalidateTargets.some(
    t => t.path.length <= rootRefreshThreshold + (t.getChildren ? 0 : 1)
  );
  if (rootNeedsRefresh) {
    return undefined;
  }
  if (targetParents) {
    // tree-finder doesn't correctly refresh parents of folders, so we work around it for now
    // (in more detail, tree-finder will only refresh the folder if the entry does not have a
    // getChildren entry, go figure...)
    return invalidateTargets.map(t => ({ ...t, getChildren: undefined }));
  }
  return invalidateTargets;
}


/**
 * Split a "pathstr" into its drive and path components
 */
export function splitPathstrDrive(pathstr: string): [string, string] {
  const splitloc = pathstr.indexOf("/");
  if (splitloc === -1) {
    return [pathstr, ""];
  }
  // split, and trim leading forward slashes on the path component
  return [pathstr.slice(0, splitloc), pathstr.slice(splitloc + 1).replace(/^[/]*/, "")];
}
