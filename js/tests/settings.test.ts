/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */
import "isomorphic-fetch";

import { unpartialResource } from "../src/settings";
import { IFSSettingsResource } from "../src/filesystem";

describe("unpartialResource", () => {

  it("should replace non-existing fields with empty string", () => {

    // blank resource missing name and url (like after pressing "add")
    const resource: IFSSettingsResource = { auth: "ask", type: "pyfs", defaultWritable: true };
    const unpartialed = unpartialResource(resource);

    expect(unpartialed.name).toEqual("");
    expect(unpartialed.url).toEqual("");
  });
});
