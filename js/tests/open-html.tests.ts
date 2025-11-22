import "isomorphic-fetch";

import { getFactories } from "../src/commands";

// Minimal fake types to exercise getFactories
const fakeDocRegistry: any = {
  preferredWidgetFactories: (path: string) => {
    // default order: text editor first, html viewer second
    return [
      { name: "FileEditor", label: "Editor" },
      { name: "HTMLViewer", label: "HTML Viewer" },
    ];
  },
  getWidgetFactory: (_: string) => undefined,
};

const fakeWidget: any = {
  url: "file:///root",
};

const makeItem = (p: string) => ({
  getPathAtDepth: (_: number) => [p],
  row: { kind: "file" },
});

describe("getFactories html preference", () => {
  it("should prefer HTML viewer for .html files", () => {
    const item = makeItem("index.html");
    const factories = getFactories(fakeDocRegistry, fakeWidget as any, item as any);
    expect(factories.length).toBeGreaterThan(0);
    // HTMLViewer should be first when present
    expect(factories[0].name).toContain("HTMLViewer");
  });

  it("should not reorder for non-html files", () => {
    const item = makeItem("readme.txt");
    const factories = getFactories(fakeDocRegistry, fakeWidget as any, item as any);
    // For non-html, the default order from preferredWidgetFactories remains
    expect(factories[0].name).toContain("FileEditor");
  });
});
