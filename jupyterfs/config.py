# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
from jupyter_server.services.contents.largefilemanager import LargeFileManager
from jupyter_server.services.contents.manager import ContentsManager
from jupyter_server.transutils import _i18n
from traitlets import Bool, List, Type, Unicode
from traitlets.config import Configurable

__all__ = ["JupyterFs"]


class JupyterFs(Configurable):
    root_manager_class = Type(
        config=True,
        default_value=LargeFileManager,
        help=_i18n(
            "the root contents manager class to use. Used by the Jupyterlab default filebrowser and elsewhere"
        ),
        klass=ContentsManager,
    )

    resources = List(
        config=True,
        default_value=[],
        help=_i18n("server-side definitions of fsspec resources for jupyter-fs"),
        # trait=Dict(traits={"name": Unicode, "url": Unicode}),
    )

    allow_user_resources = Bool(
        default_value=True,
        config=True,
        help=_i18n("whether to allow users to configure resources via settings"),
    )

    resource_validators = List(
        config=True,
        default_value=[".*"],
        trait=Unicode(),
        help=_i18n(
            "regular expressions to match against resource URLs. At least one must match"
        ),
    )
