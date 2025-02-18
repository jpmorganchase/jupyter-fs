# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#

from jupyter_server.services.contents.checkpoints import Checkpoints
from jupyter_server.services.contents.filecheckpoints import GenericFileCheckpoints

__all__ = ("NullCheckpoints",)


class PyFilesystemCheckpoints(GenericFileCheckpoints):
    pass


class NullCheckpoints(Checkpoints):
    def null_checkpoint(self):
        """Return a null checkpoint."""
        return dict(id="checkpoint", last_modified="")

    def create_checkpoint(self, contents_mgr, path):
        """Return a null checkpoint."""
        return self.null_checkpoint()

    def restore_checkpoint(self, contents_mgr, checkpoint_id, path):
        """No-op."""
        pass

    def rename_checkpoint(self, checkpoint_id, old_path, new_path):
        """No-op."""
        pass

    def delete_checkpoint(self, checkpoint_id, path):
        """No-op."""
        pass

    def list_checkpoints(self, path):
        """Return an empty list."""
        return [self.null_checkpoint()]
