# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
from __future__ import print_function
import json
from notebook.utils import url_path_join
from notebook.base.handlers import IPythonHandler
from .meta_contents_manager import MetaContentsManager


class GetHandler(IPythonHandler):
    def initialize(self, keys=None):
        # dont append colon for default
        self.keys = keys or []

    def get(self):
        '''Returns all the available contents manager prefixes

        e.g. if the contents manager configuration is something like:
        {
            "file": LargeFileContentsManager,
            "s3": S3ContentsManager,
            "samba": SambaContentsManager
        }

        the result here will be:
        ["file", "s3", "samba"]

        which will allow the frontent to instantiate 3 new filetrees, one
        for each of the available contents managers.
        '''
        self.finish(json.dumps(self.keys))


def load_jupyter_server_extension(nb_server_app):
    """
    Called when the extension is loaded.

    Args:
        nb_server_app (NotebookWebApplication): handle to the Notebook webserver instance.
    """
    web_app = nb_server_app.web_app
    base_url = web_app.settings['base_url']
    host_pattern = '.*$'

    managers = nb_server_app.config.get('JupyterFS', {}).get('contents_managers', {})

    if isinstance(nb_server_app.contents_manager, MetaContentsManager):
        nb_server_app.contents_manager.init(managers)
        print('Jupyter-fs active with {} managers'.format(len(nb_server_app.contents_manager._contents_managers)))

        print('Installing jupyter-fs handler on path %s' % url_path_join(base_url, 'multicontents'))
        web_app.add_handlers(host_pattern, [(url_path_join(base_url, 'multicontents/get'), GetHandler, {'keys': list(nb_server_app.contents_manager._contents_managers.keys())})])

    else:
        print('Not using jupyter-fs')
