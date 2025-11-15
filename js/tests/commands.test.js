/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */
import "isomorphic-fetch";

import { idFromResource } from "../src/commands";
import { IFSResource } from "../src/filesystem";

describe("idFromResource", () => {
  it("should generate consistent IDs for resource names without spaces", () => {
    const resource: IFSResource = {
      name: "myfilesystem",
      url: "file:///path/to/fs",
      auth: "ask",
      type: "pyfs",
      drive: "abc12345"
    };
    
    const id1 = idFromResource(resource);
    const id2 = idFromResource(resource);
    
    expect(id1).toEqual(id2);
    expect(id1).toContain("abc12345");
  });

  it("should handle resource names with spaces correctly", () => {
    const resource: IFSResource = {
      name: "homedir fsspec",
      url: "file:///Users/timkpaine/Developer/projects/painebot/jupyter-fs",
      auth: "ask",
      type: "fsspec",
      drive: "def67890"
    };
    
    const id = idFromResource(resource);
    
    // The ID should contain the drive
    expect(id).toContain("def67890");
    // The ID should properly encode the space
    expect(id).toContain("%20");
    // Spaces should not be simply removed (which was the bug)
    expect(id).not.toEqual("homedirfsspec_def67890");
  });

  it("should handle resource names with special characters", () => {
    const resource: IFSResource = {
      name: "my-fs/resource",
      url: "file:///path",
      auth: "ask",
      type: "pyfs",
      drive: "hash123"
    };
    
    const id = idFromResource(resource);
    
    // Should properly encode special characters
    expect(id).toContain("hash123");
    // hyphen is not encoded by encodeURIComponent (it's unreserved)
    expect(id).toContain("my-fs");
    // forward slash should be encoded
    expect(id).toContain("%2F");
  });

  it("should generate different IDs for resources with similar names that differ only in spaces", () => {
    const resource1: IFSResource = {
      name: "my fs",
      url: "file:///path1",
      auth: "ask",
      type: "pyfs",
      drive: "hash1"
    };
    
    const resource2: IFSResource = {
      name: "myfs",
      url: "file:///path2",
      auth: "ask",
      type: "pyfs",
      drive: "hash2"
    };
    
    const id1 = idFromResource(resource1);
    const id2 = idFromResource(resource2);
    
    // IDs should be different
    expect(id1).not.toEqual(id2);
    // resource1's ID should have %20 (encoded space)
    expect(id1).toContain("%20");
    // resource2's ID should not have a space
    expect(id2).not.toContain("%20");
  });

  it("should use the drive hash for uniqueness when names are the same", () => {
    const resource1: IFSResource = {
      name: "shared-name",
      url: "file:///path1",
      auth: "ask",
      type: "pyfs",
      drive: "drive1"
    };
    
    const resource2: IFSResource = {
      name: "shared-name",
      url: "file:///path2",
      auth: "ask",
      type: "pyfs",
      drive: "drive2"
    };
    
    const id1 = idFromResource(resource1);
    const id2 = idFromResource(resource2);
    
    // IDs should be different due to different drives
    expect(id1).not.toEqual(id2);
    expect(id1).toContain("drive1");
    expect(id2).toContain("drive2");
  });
});
