

import { PromiseDelegate } from "@lumino/coreutils";
import { showErrorMessage } from "@jupyterlab/apputils";
import { Contents } from "@jupyterlab/services";
import { IContentRow, Path } from "@tree-finder/base";


/**
 * Wrapper for a drive onto the contents manager.
 */
export class ContentsProxy {
  constructor(contentsManager: Contents.IManager, drive?: string, onGetChildren?: ContentsProxy.GetChildrenCallback) {
    this.contentsManager = contentsManager;
    this.drive = drive;
    this.onGetChildren = onGetChildren;
  }

  async get(path: string, options?: Contents.IFetchOptions) {
    path = ContentsProxy.toFullPath(path, this.drive);
    return ContentsProxy.toJupyterContentRow(await this.contentsManager.get(path, options), this.contentsManager, this.drive, this.onGetChildren);
  }

  async save(path: string, options?: Partial<Contents.IModel>) {
    path = ContentsProxy.toFullPath(path, this.drive);
    return ContentsProxy.toJupyterContentRow(await this.contentsManager.save(path, options), this.contentsManager, this.drive, this.onGetChildren);
  }

  async rename(path: string, newPath: string) {
    path = ContentsProxy.toFullPath(path, this.drive);
    newPath = ContentsProxy.toFullPath(newPath, this.drive);
    return ContentsProxy.toJupyterContentRow(await this.contentsManager.rename(path, newPath), this.contentsManager, this.drive, this.onGetChildren);
  }

  async newUntitled(options: Contents.ICreateOptions) {
    options.path = options.path && ContentsProxy.toFullPath(options.path, this.drive);
    return ContentsProxy.toJupyterContentRow(await this.contentsManager.newUntitled(options), this.contentsManager, this.drive, this.onGetChildren);
  }

  async downloadUrl(path: string) {
    path = ContentsProxy.toFullPath(path, this.drive);
    return await this.contentsManager.getDownloadUrl(path);
  }

  readonly contentsManager: Contents.IManager;
  readonly drive?: string;
  readonly onGetChildren?: ContentsProxy.GetChildrenCallback;
}

export namespace ContentsProxy {
  export interface IJupyterContentRow extends Omit<Contents.IModel, "path" | "content" | "type">, IContentRow {}

  export type GetChildrenCallback = (path: string, done: Promise<void>) => void;

  export function toFullPath(path: string, drive?: string): string {

    if (!drive || path.startsWith(`${drive}:`)) {
      if (path.startsWith(`${drive}:/`)) {
        return path.replace(`${drive}:/`, `${drive}:`);
      }
      return path;
    } else if (path.startsWith(`${drive}/`)) {
      return [drive, path.slice(drive.length + 1)].join(":");
    } else {
      return [drive, path].join(":");
    }
  }

  export function toLocalPath(path: string): string {
    const [first, ...rest] = path.split("/");
    return [first.split(":").pop(), ...rest].join("/");
  }

  export function toJupyterContentRow(row: Contents.IModel, contentsManager: Contents.IManager, drive?: string, onGetChildren?: ContentsProxy.GetChildrenCallback): IJupyterContentRow {
    const { path, type, ...rest } = row;

    const pathWithDrive = toFullPath(path, drive).replace(/\/$/, "");
    const kind = type === "directory" ? "dir" : type;

    return {
      path: Path.toarray(pathWithDrive),
      kind,
      ...rest,
      ...(kind === "dir" ? {
        getChildren: async () => {
          let contents: Contents.IModel;
          const done = new PromiseDelegate<void>();
          if (onGetChildren) {
            const pathstr = Path.toarray(pathWithDrive).join("/");  // maybe clean up the different path formats we have...
            onGetChildren(pathstr, done.promise);
          }

          try {
            contents = await contentsManager.get(pathWithDrive, { content: true });
            done.resolve();
          } catch (error) {
            void showErrorMessage("Failed to get directory contents", error as string);
            done.reject("Failed to get directory contents");
            return [];
          }
          return (contents.content as Contents.IModel[]).map(c => toJupyterContentRow(c, contentsManager, drive, onGetChildren));
        },
      }: {}),
    };
  }
}
