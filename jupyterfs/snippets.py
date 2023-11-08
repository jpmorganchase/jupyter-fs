# *****************************************************************************
#
# Copyright (c) 2023, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#

from jupyter_server.base.handlers import APIHandler
from tornado import web

from .config import JupyterFs as JupyterFsConfig


class SnippetsHandler(APIHandler):
    _jupyterfsConfig = None

    @property
    def fsconfig(self):
        # TODO: This pattern will not pick up changes to config after this!
        if self._jupyterfsConfig is None:
            self._jupyterfsConfig = JupyterFsConfig(config=self.config)

        return self._jupyterfsConfig

    @web.authenticated
    def get(self):
        """Get the server-side configured snippets"""
        self.write({"snippets": self.fsconfig.snippets})
