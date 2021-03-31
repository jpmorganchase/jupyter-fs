# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
from __future__ import print_function

import warnings

from jupyter_server.utils import url_path_join

from ._version import __version__  # noqa: F401
from .metamanager import MetaManager, MetaManagerHandler

_mm_config_warning_msg = """Misconfiguration of MetaManager. Please add:

"ServerApp": {
  "contents_manager_class": "jupyterfs.metamanager.MetaManager"
}

to your Notebook Server config."""


def _jupyter_server_extension_paths():
    return [{'module': 'jupyterfs.extension'}]


def load_jupyter_server_extension(nb_server_app):
    """
    Called when the extension is loaded.

    Args:
        nb_server_app (NotebookWebApplication): handle to the Notebook webserver instance.
    """
    web_app = nb_server_app.web_app
    base_url = web_app.settings['base_url']
    host_pattern = '.*$'

    if not isinstance(nb_server_app.contents_manager, MetaManager):
        warnings.warn(_mm_config_warning_msg)
        return

    resources_url = 'jupyterfs/resources'
    print('Installing jupyter-fs resources handler on path %s' % url_path_join(base_url, resources_url))
    web_app.add_handlers(host_pattern, [(url_path_join(base_url, resources_url), MetaManagerHandler)])
