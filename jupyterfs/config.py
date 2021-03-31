# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
from jupyter_server.services.contents.largefilemanager import LargeFileManager
from jupyter_server.services.contents.manager import ContentsManager
from jupyter_server.transutils import _
from traitlets import List, Type
from traitlets.config import Configurable

__all__ = ["Jupyterfs"]

class Jupyterfs(Configurable):
    root_manager_class = Type(
        config=True,
        default_value=LargeFileManager,
        help=_("the root contents manager class to use. Used by the Jupyterlab default filebrowser and elsewhere"),
        klass=ContentsManager,
    )

    resources = List(
        config=True,
        default_value=[],
        help=_("server-side definitions of fsspec resources for jupyter-fs"),
        # trait=Dict(traits={"name": Unicode, "url": Unicode}),
    )
