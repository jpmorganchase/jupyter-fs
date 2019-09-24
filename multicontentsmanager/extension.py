from __future__ import print_function
from notebook.utils import url_path_join
from .handlers import GetHandler
from .metacontentsmanager import MetaContentsManager


def load_jupyter_server_extension(nb_server_app):
    """
    Called when the extension is loaded.

    Args:
        nb_server_app (NotebookWebApplication): handle to the Notebook webserver instance.
    """
    web_app = nb_server_app.web_app
    base_url = web_app.settings['base_url']
    host_pattern = '.*$'

    managers = nb_server_app.config.get('MultiContentsManager', {}).get('contents_managers', {})

    if isinstance(nb_server_app.contents_manager, MetaContentsManager):
        nb_server_app.contents_manager.init(managers)
        print('MultiContentsManager active with {} managers'.format(len(nb_server_app.contents_manager._contents_managers)))

        print('Installing multicontentsmanager handler on path %s' % url_path_join(base_url, 'multicontents'))
        web_app.add_handlers(host_pattern, [(url_path_join(base_url, 'multicontents/get'), GetHandler, {'keys': list(nb_server_app.contents_manager._contents_managers.keys())})])

    else:
        print('Not using MultiContentsManager')
