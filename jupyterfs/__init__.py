# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
from ._version import __version__  # noqa: F401
from .extension import _jupyter_server_extension_points

import json
from pathlib import Path

HERE = Path(__file__).parent.resolve()
with (HERE / "labextension" / "package.json").open() as fid:
    data = json.load(fid)


def open_fs(fs_url, **kwargs):
    """Wrapper around fs.open_fs with {{variable}} substitution"""
    import fs
    from .auth import stdin_prompt

    # substitute credential variables via `getpass` queries
    fs_url = stdin_prompt(fs_url)
    return fs.open_fs(fs_url, **kwargs)


def _jupyter_labextension_paths():
    return [
        {
            "src": "labextension",
            "dest": data["name"],
        }
    ]
