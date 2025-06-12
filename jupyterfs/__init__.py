# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
import json
from pathlib import Path

from .extension import _jupyter_server_extension_points
from .fs_wrapper import fs, fs_instance
from .metamanager import MetaManager, SyncMetaManager

__version__ = "1.1.0"

__all__ = (
    "_jupyter_labextension_paths",
    "_jupyter_server_extension_points",
    "fs",
    "fs_instance",
    "MetaManager",
    "SyncMetaManager",
)

HERE = Path(__file__).parent.resolve()
with (HERE / "labextension" / "package.json").open() as fid:
    data = json.load(fid)


def _jupyter_labextension_paths():
    return [
        {
            "src": "labextension",
            "dest": data["name"],
        }
    ]
