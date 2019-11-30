from notebook.services.contents.largefilemanager import LargeFileManager


class AbsolutePathFileManager(LargeFileManager):
    """Handle large file upload."""

    def __init__(self, root_dir='', **kwargs):
        super(AbsolutePathFileManager, self).__init__(**kwargs)
        self.root_dir = root_dir
