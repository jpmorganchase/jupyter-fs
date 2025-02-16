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
from traitlets import Bool, Dict, List, Type, Unicode
from traitlets.config import Configurable

__all__ = ["JupyterFs"]


class JupyterFs(Configurable):
    root_manager_class = Type(
        config=True,
        default_value=LargeFileManager,
        help=_i18n("the root contents manager class to use. Used by the Jupyterlab default filebrowser and elsewhere"),
        klass=ContentsManager,
    )

    resources = List(
        config=True,
        default_value=[],
        help=_i18n("server-side definitions of pyfilesystem/fsspec resources for jupyter-fs"),
        # trait=Dict(traits={"name": Unicode, "url": Unicode}),
    )

    allow_user_resources = Bool(
        default_value=True,
        config=True,
        help=_i18n("whether to allow users to configure resources via settings"),
    )

    resource_validators = List(
        config=True,
        trait=Unicode(),
        help=_i18n("regular expressions to match against resource URLs. At least one must match"),
    )

    surface_init_errors = Bool(
        default_value=False,
        config=True,
        help=_i18n("whether to surface init errors to the client"),
    )

    snippets = List(
        config=True,
        per_key_traits=Dict(
            {
                "label": Unicode(help="The designator to show to users"),
                "caption": Unicode("", help="An optional, longer description to show to users"),
                "pattern": Unicode(
                    "",
                    help="A regular expression to match against the full URL of the entry, indicating if this snippet is valid for it",
                ),
                "template": Unicode(help="A template string to build up the snippet"),
            }
        ),
        help=_i18n("per entry snippets for how to use it, e.g. a snippet for how to open a file from a given resource"),
    )
