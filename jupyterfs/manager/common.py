# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
from datetime import datetime

from jupyter_server import _tz as tz

__all__ = (
    "EPOCH_START",
    "FileSystemLoadError",
)


EPOCH_START = datetime(1970, 1, 1, 0, 0, tzinfo=tz.UTC)


class FileSystemLoadError(RuntimeError):
    """Raised when a filesystem cannot be loaded."""

    pass
