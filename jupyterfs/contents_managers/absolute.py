# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#

from notebook.services.contents.largefilemanager import LargeFileManager


class AbsolutePathFileManager(LargeFileManager):
    """Handle large file upload."""

    def __init__(self, root_dir='', **kwargs):
        super(AbsolutePathFileManager, self).__init__(**kwargs)
        self.root_dir = root_dir
