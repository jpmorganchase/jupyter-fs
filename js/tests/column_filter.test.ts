/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */
import {
  matchLastModifiedFilter,
  matchSizeFilter,
  parseComparisonPattern,
  parseFilterDate,
  parseSizeToBytes,
} from "../src/column_filter";

describe("parseComparisonPattern", () => {
  it("parses comparison operators", () => {
    expect(parseComparisonPattern(">= 10")).toEqual({ op: ">=", rest: "10" });
    expect(parseComparisonPattern("<1 MiB")).toEqual({ op: "<", rest: "1 MiB" });
    expect(parseComparisonPattern("days")).toEqual({ op: null, rest: "days" });
  });
});

describe("parseSizeToBytes", () => {
  it("parses byte magnitudes with units", () => {
    expect(parseSizeToBytes("1024")).toBe(1024);
    expect(parseSizeToBytes("1 KiB")).toBe(1024);
    expect(parseSizeToBytes("2 MB")).toBe(2_000_000);
  });
});

describe("matchSizeFilter", () => {
  it("matches human-readable substrings", () => {
    expect(matchSizeFilter(1536, "KiB")).toBe(true);
    expect(matchSizeFilter(1536, "1.5")).toBe(true);
  });

  it("supports ordered comparisons on raw bytes", () => {
    expect(matchSizeFilter(2048, ">1 KiB")).toBe(true);
    expect(matchSizeFilter(512, ">1 KiB")).toBe(false);
    expect(matchSizeFilter(1000, "<=1 KB")).toBe(true);
  });

  it("rejects missing sizes unless pattern is empty", () => {
    expect(matchSizeFilter(null, "1")).toBe(false);
    expect(matchSizeFilter(undefined, "")).toBe(true);
  });
});

describe("matchLastModifiedFilter", () => {
  const iso = "2020-06-15T12:00:00.000Z";

  it("matches relative-time display text", () => {
    expect(matchLastModifiedFilter(iso, "year")).toBe(true);
  });

  it("supports ordered comparisons on parsed dates", () => {
    expect(matchLastModifiedFilter(iso, ">2019-01-01")).toBe(true);
    expect(matchLastModifiedFilter(iso, "<2019-01-01")).toBe(false);
  });
});

describe("parseFilterDate", () => {
  it("parses ISO date strings", () => {
    const date = parseFilterDate("2024-05-01");
    expect(date?.getUTCFullYear()).toBe(2024);
  });
});
