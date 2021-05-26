# -*- coding: utf-8 -*-
# This file reproduces https://github.com/jupyterlab/jupyterlab/blob/master/jupyterlab/browser_check.py
# but patch the global `here` to use the local browser-test.js
import os
import jupyterlab.browser_check
from unittest.mock import patch

class JupyterfsBrowserApp(jupyterlab.browser_check.BrowserApp):
    name = __name__

def _jupyter_server_extension_points():
    return [
        {
            'module': __name__,
            'app': JupyterfsBrowserApp
        }
    ]


# TODO: remove handling of --notebook arg and the following two
# functions in JupyterLab 4.0
def load_jupyter_server_extension(serverapp):
    extension = JupyterfsBrowserApp()
    extension.serverapp = serverapp
    extension.load_config_file()
    extension.update_config(serverapp.config)
    extension.parse_command_line(serverapp.extra_args)
    extension.initialize()


def _jupyter_server_extension_paths():
    return [
        {
            'module': 'jupyterlab.browser_check'
        }
    ]


if __name__ == '__main__':
    here = os.path.abspath(os.path.dirname(__file__))

    with patch('jupyterlab.browser_check.here', here):
        JupyterfsBrowserApp.launch_instance()
