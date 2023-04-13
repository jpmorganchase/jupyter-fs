
import { WidgetTracker } from "@jupyterlab/apputils";
import { Token } from "@lumino/coreutils";
import { TreeFinderSidebar } from "./treefinder";

export const ITreeFinderTracker = new Token<ITreeFinderTracker>(
  "@jupyterlab/filebrowser:IFileBrowserFactory"
);

/**
 * The file browser factory interface.
 */
export interface ITreeFinderTracker {
  /**
   * The widget tracker that tracks tree finders.
   */
  readonly tracker: WidgetTracker<TreeFinderSidebar>;
}
