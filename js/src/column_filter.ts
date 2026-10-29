/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */
import {
  Content,
  ContentsModel,
  FilterPatterns,
  Format,
  IContentRow,
  SortStates,
  filterSortContentRoot,
} from "@tree-finder/base";

import { ContentsProxy } from "./contents_proxy";

type JupyterContentRow = ContentsProxy.IJupyterContentRow;

const SIZE_UNITS: { [unit: string]: number } = {
  b: 1,
  kb: 1000,
  kib: 1024,
  mb: 1000 ** 2,
  mib: 1024 ** 2,
  gb: 1000 ** 3,
  gib: 1024 ** 3,
  tb: 1000 ** 4,
  tib: 1024 ** 4,
};

type ComparisonOp = ">" | ">=" | "<" | "<=" | "=";

interface ParsedComparison {
  op: ComparisonOp | null;
  rest: string;
}

export function parseComparisonPattern(pattern: string): ParsedComparison {
  const match = pattern.trim().match(/^(>=|<=|>|<|=)\s*(.*)$/);
  if (!match) {
    return { op: null, rest: pattern.trim() };
  }
  return { op: match[1] as ComparisonOp, rest: match[2].trim() };
}

export function parseSizeToBytes(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const unitMatch = trimmed.match(/^([+-]?\d+(?:\.\d+)?)\s*([a-z]+)?$/i);
  if (!unitMatch) {
    const asNumber = Number(trimmed);
    return Number.isNaN(asNumber) ? null : asNumber;
  }

  const magnitude = Number(unitMatch[1]);
  if (Number.isNaN(magnitude)) {
    return null;
  }

  const unit = (unitMatch[2] ?? "b").toLowerCase();
  const multiplier = SIZE_UNITS[unit];
  if (multiplier === undefined) {
    return null;
  }

  return magnitude * multiplier;
}

export function matchSizeFilter(
  size: JupyterContentRow["size"] | null,
  pattern: string,
): boolean {
  const trimmed = pattern.trim();
  if (!trimmed) {
    return true;
  }

  if (size === null || size === undefined) {
    return false;
  }

  const { op, rest } = parseComparisonPattern(trimmed);
  if (op) {
    const target = parseSizeToBytes(rest);
    if (target !== null) {
      switch (op) {
        case ">":
          return size > target;
        case ">=":
          return size >= target;
        case "<":
          return size < target;
        case "<=":
          return size <= target;
        case "=":
          return size === target;
      }
    }
  }

  const formatted = Format.bytesToHumanReadable(size).toLowerCase();
  const needle = trimmed.toLowerCase();
  if (formatted.includes(needle)) {
    return true;
  }

  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric)) {
    return size === numeric;
  }

  return false;
}

export function parseFilterDate(text: string): Date | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed);
}

export function matchLastModifiedFilter(
  lastModified: JupyterContentRow["last_modified"],
  pattern: string,
): boolean {
  const trimmed = pattern.trim();
  if (!trimmed) {
    return true;
  }

  if (!lastModified) {
    return false;
  }

  const date = new Date(lastModified);
  if (Number.isNaN(date.valueOf())) {
    return false;
  }

  const { op, rest } = parseComparisonPattern(trimmed);
  if (op) {
    const target = parseFilterDate(rest);
    if (target) {
      const value = date.valueOf();
      const targetValue = target.valueOf();
      switch (op) {
        case ">":
          return value > targetValue;
        case ">=":
          return value >= targetValue;
        case "<":
          return value < targetValue;
        case "<=":
          return value <= targetValue;
        case "=":
          return value === targetValue;
      }
    }
  }

  const display = Format.timeSince(date).toLowerCase();
  if (display.includes(trimmed.toLowerCase())) {
    return true;
  }

  return Format.DATE_FORMATTER.format(date)
    .toLowerCase()
    .includes(trimmed.toLowerCase());
}

function jupyterContentsFilterer<T extends IContentRow>(
  filterPatterns: FilterPatterns<T>,
  pathDepth: number,
): Content.Filterer<T> {
  return function contentsFilterer(content: Content<T>): boolean {
    for (const key of Object.keys(filterPatterns.patterns) as Array<keyof T>) {
      const pattern = filterPatterns.patterns[key];
      if (key === "path") {
        return content
          .getPathAtDepth(pathDepth)
          .join("/")
          .includes(pattern);
      }

      const val = content.row[key];

      if (key === "size") {
        return matchSizeFilter(val as JupyterContentRow["size"], pattern);
      }

      if (key === "last_modified") {
        return matchLastModifiedFilter(val as JupyterContentRow["last_modified"], pattern);
      }

      if (typeof val === "string") {
        return val.includes(pattern);
      }
      if (val instanceof Date) {
        return Format.dateToStr(val, pattern);
      }
      if (typeof val === "boolean") {
        const num = Number(pattern);
        return (
          (!Number.isNaN(num) && val === !!num) ||
          (val ? "true" : "false").includes(pattern)
        );
      }

      const numeric = val as number | null | undefined;
      return numeric === Number(pattern);
    }
    return true;
  };
}

async function jupyterFilterContentRoot<T extends IContentRow>({
  root,
  filterPatterns,
  pathDepth,
}: {
  root: Content<T>;
  filterPatterns: FilterPatterns<T>;
  pathDepth?: number;
}): Promise<Array<Content<T>>> {
  root.filterer = jupyterContentsFilterer(
    filterPatterns,
    pathDepth ?? root.row.path.length,
  );
  return root.flatten();
}

async function jupyterFilterSortContentRoot<T extends IContentRow>(
  params: Parameters<typeof filterSortContentRoot<T>>[0],
): Promise<[Array<Content<T>>, SortStates<T>]> {
  const [, sortStates] = await filterSortContentRoot(params);
  const pathDepth = params.pathDepth ?? params.root.row.path.length;
  params.root.filterer = jupyterContentsFilterer(
    params.filterPatterns,
    pathDepth,
  );
  return [await params.root.flatten(), sortStates];
}

type ContentsModelInternals<T extends IContentRow> = ContentsModel<T> & {
  _contents: Array<Content<T>>;
  _filterPatterns: FilterPatterns<T>;
  _parentMap: WeakMap<T, T>;
  _root: Content<T>;
  _sortStates: SortStates<T>;
};

/**
 * Use semantic filters for size and last_modified while preserving tree-finder behavior elsewhere.
 */
export function patchContentsModelFiltering(
  model: ContentsModel<JupyterContentRow>,
): void {
  const m = model as ContentsModelInternals<JupyterContentRow>;

  model.onFilterInput = fpat => {
    m._filterPatterns.set(fpat);
    void model.filter();
  };

  model.filter = async ({ autosize = true } = {}) => {
    await m._root.expand();
    m._contents = await jupyterFilterContentRoot({
      filterPatterns: m._filterPatterns,
      root: m._root,
    });
    model.requestDraw({ autosize });
  };

  model.sort = async (
    props: { autosize?: boolean; col?: keyof JupyterContentRow; multisort?: boolean } = {},
  ) => {
    const { autosize = false, col, multisort } = props;
    await m._root.expand();
    [m._contents, m._sortStates] = await jupyterFilterSortContentRoot({
      col,
      filterPatterns: m._filterPatterns,
      multisort,
      root: m._root,
      sortStates: m._sortStates,
    });
    model.requestDraw({ autosize });
  };

  model.expand = async (rix: number) => {
    const content = m._contents[rix];
    await content.expand();
    for (const child of (await content?.getChildren()) ?? []) {
      m._parentMap.set(child.row, content.row);
    }

    let nodeContents: Array<Content<JupyterContentRow>>;
    [nodeContents, m._sortStates] = await jupyterFilterSortContentRoot({
      filterPatterns: m._filterPatterns,
      pathDepth: model.pathDepth,
      root: content,
      sortStates: m._sortStates,
    });
    m._contents.splice(rix + 1, 0, ...nodeContents);
    model.requestDraw();
  };
}
