# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#

from unittest.mock import patch

from jupyterfs import _jupyter_labextension_paths, fs
from jupyterfs.extension import _jupyter_server_extension_points


class TestInit:
    # for Coverage
    def test__jupyter_server_extension_paths(self):
        assert _jupyter_server_extension_points() == [{"module": "jupyterfs.extension"}]

    # for Coverage
    def test__jupyter_labextension_paths(self):
        assert _jupyter_labextension_paths() == [
            {
                "src": "labextension",
                "dest": "jupyter-fs",
            }
        ]

    @patch("fs.opener.open")
    @patch("getpass.getpass", return_value="test return getpass <>/|")
    def test_open_fs(self, mock_getpass, mock_fs_open_fs):
        mock_fs_open_fs.return_value = "mock fs instance", "mock root"
        fs("osfs://foo/bar.txt")
        mock_getpass.assert_not_called()
        mock_fs_open_fs.assert_called_with("osfs://foo/bar.txt")

        fs("osfs://{{foo}}/bar.txt")
        mock_getpass.assert_called_with("Enter value for 'foo': ")
        mock_fs_open_fs.assert_called_with("osfs://test%20return%20getpass%20%3C%3E/%7C/bar.txt")
