/******************************************************************************
 *
 * Copyright (c) 2019, the jupyter-fs authors.
 *
 * This file is part of the jupyter-fs library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import { LabIcon } from "@jupyterlab/ui-components";

import driveSvgstr from "../style/icons/drive.svg";
import fileTreeSvgstr from "../style/icons/file-tree.svg";

export const driveIcon = new LabIcon({ name: "fs:drive", svgstr: driveSvgstr });
export const fileTreeIcon = new LabIcon({ name: "fs:file-tree", svgstr: fileTreeSvgstr });
