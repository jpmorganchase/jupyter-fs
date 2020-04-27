# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
from __future__ import print_function
import warnings

from notebook.utils import url_path_join

from .meta_contents_manager import MetaContentsHandler, MetaContentsManager

_mc_config_warning_msg = """Misconfiguration of MetaContentsManager. Please add:

"NotebookApp": {
  "contents_manager_class": "jupyterfs.meta_contents_manager.MetaContentsManager"
}

to your Notebook Server config."""

def load_jupyter_server_extension(nb_server_app):
    """
    Called when the extension is loaded.

    Args:
        nb_server_app (NotebookWebApplication): handle to the Notebook webserver instance.
    """
    web_app = nb_server_app.web_app
    base_url = web_app.settings['base_url']
    host_pattern = '.*$'

    if not isinstance(nb_server_app.contents_manager, MetaContentsManager):
        warnings.warn(_mc_config_warning_msg)
        return

    # init managers from resources described in notebook server config
    nb_server_app.contents_manager.initResource(
        *nb_server_app.config.get('jupyterfs', {}).get('resources', [])
    )
    print('Jupyter-fs active with {} managers'.format(len(nb_server_app.contents_manager._contents_managers)))

    print('Installing jupyter-fs handler on path %s' % url_path_join(base_url, 'multicontents'))
    web_app.add_handlers(host_pattern, [(url_path_join(base_url, 'multicontents/get'), MetaContentsHandler)])
