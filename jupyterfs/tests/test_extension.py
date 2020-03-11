# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#

# for Coverage
import tornado.web
from mock import MagicMock
from jupyterfs.extension import load_jupyter_server_extension, GetHandler


class TestExtension:
    def test_load_jupyter_server_extension(self):

        m = MagicMock()

        m.web_app.settings = {}
        m.web_app.settings['base_url'] = '/test'
        load_jupyter_server_extension(m)

    def test_get_handler(self):
        app = tornado.web.Application()
        m = MagicMock()
        h = GetHandler(app, m)
        h._transforms = []
        h.get()
