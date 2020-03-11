# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#

# for Coverage
from jupyterfs import _jupyter_server_extension_paths


class TestInit:
    def test__jupyter_server_extension_paths(self):
        assert _jupyter_server_extension_paths() == [{"module": "jupyterfs.extension"}]
