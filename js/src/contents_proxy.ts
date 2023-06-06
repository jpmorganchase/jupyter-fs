
import { showErrorMessage } from "@jupyterlab/apputils";
import { Contents, ContentsManager } from "@jupyterlab/services";
import { IContentRow, Path } from "tree-finder";


/**
 * Wrapper for a drive onto the contents manager.
 */
export class ContentsProxy {
  constructor(contentsManager: ContentsManager, drive?: string) {
    this.contentsManager = contentsManager;
    this.drive = drive;
  }

  async get(path: string, options?: Contents.IFetchOptions) {
    path = ContentsProxy.toFullPath(path, this.drive);
    return ContentsProxy.toJupyterContentRow(await this.contentsManager.get(path, options), this.contentsManager, this.drive);
  }

  async save(path: string, options?: Partial<Contents.IModel>) {
    path = ContentsProxy.toFullPath(path, this.drive);
    return ContentsProxy.toJupyterContentRow(await this.contentsManager.save(path, options), this.contentsManager, this.drive);
  }

  async rename(path: string, newPath: string) {
    path = ContentsProxy.toFullPath(path, this.drive);
    newPath = ContentsProxy.toFullPath(newPath, this.drive);
    return ContentsProxy.toJupyterContentRow(await this.contentsManager.rename(path, newPath), this.contentsManager, this.drive);
  }

  async newUntitled(options: Contents.ICreateOptions) {
    options.path = options.path && ContentsProxy.toFullPath(options.path, this.drive);
    return ContentsProxy.toJupyterContentRow(await this.contentsManager.newUntitled(options), this.contentsManager, this.drive);
  }

  async downloadUrl(path: string) {
    path = ContentsProxy.toFullPath(path, this.drive);
    return await this.contentsManager.getDownloadUrl(path);
  }

  readonly contentsManager: ContentsManager;
  readonly drive?: string;
}

export namespace ContentsProxy {
  export interface IJupyterContentRow extends Omit<Contents.IModel, "path" | "content" | "type">, IContentRow {}

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

  export function toJupyterContentRow(row: Contents.IModel, contentsManager: ContentsManager, drive?: string): IJupyterContentRow {
    const { path, type, ...rest } = row;

    const pathWithDrive = toFullPath(path, drive);
    const kind = type === "directory" ? "dir" : type;

    return {
      path: Path.toarray(pathWithDrive),
      kind,
      ...rest,
      ...(kind === "dir" ? {
        getChildren: async () => {
          let contents: Contents.IModel;
          try {
            contents = await contentsManager.get(pathWithDrive, { content: true });
          } catch (error) {
            void showErrorMessage("Failed to get directory contents", error as string);
            return [];
          }
          return (contents.content as Contents.IModel[]).map(c => toJupyterContentRow(c, contentsManager, drive));
        },
      }: {}),
    };
  }
}
