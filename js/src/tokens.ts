
import { WidgetTracker } from "@jupyterlab/apputils";
import { Token } from "@lumino/coreutils";
import { TreeFinderSidebar } from "./treefinder";

export const ITreeFinderMain = new Token<ITreeFinderMain>(
  "@jupyterlab/filebrowser:IFileBrowserFactory"
);

/**
 * The file browser factory interface.
 */
export interface ITreeFinderMain {
  /**
   * The widget tracker that tracks tree finders.
   */
  readonly tracker: WidgetTracker<TreeFinderSidebar>;
}
