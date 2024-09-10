/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import { ILayoutRestorer, IRouter, JupyterFrontEnd, JupyterFrontEndPlugin } from "@jupyterlab/application";
import { IThemeManager, IWindowResolver } from "@jupyterlab/apputils";
import { IDocumentManager } from "@jupyterlab/docmanager";
import { ISettingRegistry } from "@jupyterlab/settingregistry";
import { IStatusBar } from "@jupyterlab/statusbar";
import { ITranslator } from "@jupyterlab/translation";
import { folderIcon, fileIcon, IFormRendererRegistry } from "@jupyterlab/ui-components";
import { IDisposable } from "@lumino/disposable";
import * as semver from "semver";

import { commandIDs, createDynamicCommands, createStaticCommands, idFromResource } from "./commands";
import { ContentsProxy } from "./contents_proxy";
import { IFSOptions, IFSResource, IFSSettingsResource } from "./filesystem";
import { FileUploadStatus } from "./progress";
import { migrateSettings, unpartialResource } from "./settings";
import { snippetFormRender } from "./snippets";
import { TreeFinderSidebar } from "./treefinder";
import { ITreeFinderMain } from "./tokens";
import { initResources } from "./resources";

// tslint:disable: variable-name

const BROWSER_ID = "jupyter-fs:plugin";
export const browser: JupyterFrontEndPlugin<ITreeFinderMain> = {
  autoStart: true,
  id: BROWSER_ID,
  requires: [
    IDocumentManager,
    JupyterFrontEnd.IPaths,
    IWindowResolver,
    ILayoutRestorer,
    IRouter,
    ISettingRegistry,
    IThemeManager,
  ],
  optional: [IFormRendererRegistry],
  provides: ITreeFinderMain,

  async activate(
    app: JupyterFrontEnd,
    manager: IDocumentManager,
    paths: JupyterFrontEnd.IPaths,
    resolver: IWindowResolver,
    restorer: ILayoutRestorer,
    router: IRouter,
    settingRegistry: ISettingRegistry,
    themeManager: IThemeManager,
    editorRegistry: IFormRendererRegistry | null
  ): Promise<ITreeFinderMain> {
    const widgetMap : {[key: string]: TreeFinderSidebar} = {};
    let commands: IDisposable | undefined;

    // Attempt to load application settings
    let settings: ISettingRegistry.ISettings | undefined;
    try {
      settings = await settingRegistry.load(BROWSER_ID);
    } catch (error) {
      // Providing more precise error logging here
      console.warn(`Failed to load settings for the jupyter-fs extension.\n${error.message}`, {error});
    }

    // Function to update columns from settings
    function updateColumnsFromSettings() {
      return settings?.composite.display_columns as Array<keyof ContentsProxy.IJupyterContentRow> ?? ["size"];
    }

    // The settings migration check now has an additional fallback for improved reliability.
    const initialOptions = settings?.composite.options as unknown as IFSOptions | undefined;
    if ((settings && initialOptions && semver.lt(initialOptions.writtenVersion || "0.0.0", settings.version))) {
      settings = await migrateSettings(settings);
    }

    if (editorRegistry) {
      editorRegistry.addRenderer(`${BROWSER_ID}.snippets`, { fieldRenderer: snippetFormRender });
    }

    let columns = updateColumnsFromSettings();

    const sharedSidebarProps: Omit<TreeFinderSidebar.ISidebarProps, "url"> = {
      app,
      manager,
      paths,
      resolver,
      restorer,
      router,
      columns,
      settings,
    };

    createStaticCommands(app, TreeFinderSidebar.tracker, TreeFinderSidebar.clipboard);

    async function refreshWidgets({ resources, options }: {resources: IFSResource[]; options: IFSOptions}) {
      if (options.verbose) {
        console.info(`jupyter-fs frontend received resources:\n${JSON.stringify(resources)}`);
      }

      columns = updateColumnsFromSettings();
      sharedSidebarProps.columns = columns;

      // create the fs resource frontends (ie FileTree instances)
      for (const r of resources) {
        const id = idFromResource(r);
        let w = widgetMap[id];
        if (!w || w.isDisposed) {
          const sidebarProps = { ...sharedSidebarProps, url: r.url, settings: settings! };
          w = TreeFinderSidebar.sidebarFromResource(r, sidebarProps);
          widgetMap[id] = w;
        } else {
          w.treefinder.columns = columns;
        }
      }

      commands = await createDynamicCommands(
        app,
        TreeFinderSidebar.tracker,
        TreeFinderSidebar.clipboard,
        resources,
        settings
      );
    }

    async function refresh() {
      let resources: IFSResource[] = (
        settings?.composite.resources as unknown as IFSSettingsResource[] ?? []
      ).map(unpartialResource);
      const options: IFSOptions = settings?.composite.options as any ?? {};

      function cleanup(all = false) {
        if (commands) {
          commands.dispose();
          commands = undefined;
        }
        const keys = resources.map(idFromResource);
        for (const key of Object.keys(widgetMap)) {
          if (all || keys.indexOf(key) === -1) {
            widgetMap[key].dispose();
            delete widgetMap[key];
          }
        }
      }

      try {
        resources = (await initResources(resources, options)).filter(r => r.init);
        cleanup();
        await refreshWidgets({ resources, options });
      } catch (e) {
        console.error("Failed to refresh widgets!", e);
        cleanup(true);
      }
    }

    const refreshed = refresh();
    void restorer.restore(TreeFinderSidebar.tracker, {
      command: commandIDs.restore,
      args: widget => ({
        id: widget.id,
        rootPath: widget.treefinder.model?.root.pathstr,
      }),
      name: widget => widget.id,
      when: refreshed,
    });

    if (settings) {
      settings.changed.connect(() => {
        void refresh();
      }, 500); // Avoid too frequent requests with debounce of 500ms
    }

    // New useEffect-style implementation to handle theme changes
    const updateIconStyles = () => {
      const primary = getComputedStyle(document.documentElement).getPropertyValue("--jp-ui-font-color1");
      style.textContent = iconStyleContent(
        folderIcon.svgstr.replace(/fill="([^"]{0,7})"/, `fill="${primary}"`),
        fileIcon.svgstr.replace(/fill="([^"]{0,7})"/, `fill="${primary}"`)
      );
    };

    themeManager.themeChanged.connect(updateIconStyles);
    style.textContent = iconStyleContent(folderIcon.svgstr, fileIcon.svgstr);
    document.head.appendChild(style);

    return { tracker: TreeFinderSidebar.tracker };
  },
};

const PROGRESS_ID = "jupyter-fs:progress";
export const progressStatus: JupyterFrontEndPlugin<void> = {
  autoStart: true,
  id: PROGRESS_ID,
  requires: [
    ITranslator,
  ],
  optional: [
    ITreeFinderMain,
    IStatusBar,
  ],
  activate(
    app: JupyterFrontEnd,
    translator: ITranslator,
    main: ITreeFinderMain | null,
    statusbar: IStatusBar | null,
  ) {
    if (!statusbar || !main) {
      return;
    }
    const item = new FileUploadStatus({
      tracker: main.tracker,
      translator,
    });
    statusbar.registerStatusItem(
      PROGRESS_ID,
      {
        item,
        align: "middle",
        isActive: () => !!(item.model?.items.length),
        activeStateChanged: item.model.stateChanged,
      }
    );
  },
};

export default [
  browser,
  progressStatus,
];
