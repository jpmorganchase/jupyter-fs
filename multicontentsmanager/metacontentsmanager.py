from notebook.services.contents.manager import ContentsManager
from notebook.services.contents.largefilemanager import LargeFileManager


class MetaContentsManager(ContentsManager):
    def __init__(self, **kwargs):
        self._contents_managers = {'': LargeFileManager(**kwargs)}
        self._kwargs = kwargs
        self._inited = False

    def init(self, managers=None):
        if self._inited:
            return
        self._inited = True
        self._contents_managers.update({_[0]: _[1] for _ in (managers or {}).values()})

    def _which_manager(self, path):
        for k in self._contents_managers:
            basepath = path + ':'
            if path.startswith(basepath):
                return self._contents_managers[k], path.replace(basepath, '')
        return self._contents_managers[''], path.replace(basepath, '')

    def run_pre_save_hook(self, model, path, **kwargs):
        """Run the pre-save hook if defined, and log errors"""
        manager, path = self._which_manager(path)
        return manager.run_pre_save_hook(model, path)

    def run_post_save_hook(self, model, path, **kwargs):
        """Run the post-save hook if defined, and log errors"""
        manager, path = self._which_manager(path)
        return manager.run_post_save_hook(model, path)

    def get_extra_handlers(self):
        """Return additional handlers

        Default: self.files_handler_class on /files/.*
        """
        handlers = []
        for manager in self._contents_managers.values():
            handlers.extend(manager.get_extra_handlers())
        return handlers

    def dir_exists(self, path):
        """Does a directory exist at the given path?

        Like os.path.isdir

        Override this method in subclasses.

        Parameters
        ----------
        path : string
            The path to check

        Returns
        -------
        exists : bool
            Whether the path does indeed exist.
        """
        manager, path = self._which_manager(path)
        return manager.dir_exists(path)

    def is_hidden(self, path):
        """Is path a hidden directory or file?

        Parameters
        ----------
        path : string
            The path to check. This is an API path (`/` separated,
            relative to root dir).

        Returns
        -------
        hidden : bool
            Whether the path is hidden.

        """
        manager, path = self._which_manager(path)
        return manager.is_hidden(path)

    def file_exists(self, path=''):
        """Does a file exist at the given path?

        Like os.path.isfile

        Override this method in subclasses.

        Parameters
        ----------
        path : string
            The API path of a file to check for.

        Returns
        -------
        exists : bool
            Whether the file exists.
        """
        manager, path = self._which_manager(path)
        return manager.file_exists(path)

    def exists(self, path):
        """Does a file or directory exist at the given path?

        Like os.path.exists

        Parameters
        ----------
        path : string
            The API path of a file or directory to check for.

        Returns
        -------
        exists : bool
            Whether the target exists.
        """
        manager, path = self._which_manager(path)
        return manager.exists(path)

    def get(self, path, content=True, type=None, format=None):
        """Get a file or directory model."""
        manager, path = self._which_manager(path)
        return manager.get(path, content, type, format)

    def save(self, model, path):
        """
        Save a file or directory model to path.

        Should return the saved model with no content.  Save implementations
        should call self.run_pre_save_hook(model=model, path=path) prior to
        writing any data.
        """
        manager, path = self._which_manager(path)
        return manager.save(model, path)

    def delete_file(self, path):
        """Delete the file or directory at path."""
        manager, path = self._which_manager(path)
        return manager.delete_file(path)

    def rename_file(self, old_path, new_path):
        """Rename a file or directory."""
        manager, old_path = self._which_manager(old_path)
        _, new_path = self._which_manager(new_path)
        return manager.rename_file(old_path, new_path)

    def delete(self, path):
        """Delete a file/directory and any associated checkpoints."""
        manager, path = self._which_manager(path)
        return manager.delete(path)

    def rename(self, old_path, new_path):
        """Rename a file and any checkpoints associated with that file."""
        manager, old_path = self._which_manager(old_path)
        _, new_path = self._which_manager(new_path)
        return manager.rename(old_path, new_path)

    def update(self, model, path):
        """Update the file's path

        For use in PATCH requests, to enable renaming a file without
        re-uploading its contents. Only used for renaming at the moment.
        """
        manager, path = self._which_manager(path)
        return manager.update(model, path)

    def info_string(self):
        return "Serving contents"

    def get_kernel_path(self, path, model=None):
        """Return the API path for the kernel

        KernelManagers can turn this value into a filesystem path,
        or ignore it altogether.

        The default value here will start kernels in the directory of the
        notebook server. FileContentsManager overrides this to use the
        directory containing the notebook.
        """
        manager, path = self._which_manager(path)
        return manager.get_kernel_path(path, model)

    def increment_filename(self, filename, path='', insert=''):
        """Increment a filename until it is unique.

        Parameters
        ----------
        filename : unicode
            The name of a file, including extension
        path : unicode
            The API path of the target's directory
        insert: unicode
            The characters to insert after the base filename

        Returns
        -------
        name : unicode
            A filename that is unique, based on the input filename.
        """
        manager, path = self._which_manager(path)
        return manager.increment_filename(filename, path, insert)

    def new_untitled(self, path='', type='', ext=''):
        """Create a new untitled file or directory in path

        path must be a directory

        File extension can be specified.

        Use `new` to create files with a fully specified path (including filename).
        """
        manager, path = self._which_manager(path)
        return manager.new_untitled(path, type, ext)

    def new(self, model=None, path=''):
        """Create a new file or directory and return its model with no content.

        To create a new untitled entity in a directory, use `new_untitled`.
        """
        manager, path = self._which_manager(path)
        return manager.new(model, path)

    def copy(self, from_path, to_path=None):
        """Copy an existing file and return its new model.

        If to_path not specified, it will be the parent directory of from_path.
        If to_path is a directory, filename will increment `from_path-Copy#.ext`.
        Considering multi-part extensions, the Copy# part will be placed before the first dot for all the extensions except `ipynb`.
        For easier manual searching in case of notebooks, the Copy# part will be placed before the last dot.

        from_path must be a full path to a file.
        """
        manager, from_path = self._which_manager(from_path)
        _, to_path = self._which_manager(to_path)
        return manager.copy(from_path, to_path)

    def trust_notebook(self, path):
        """Explicitly trust a notebook

        Parameters
        ----------
        path : string
            The path of a notebook
        """
        manager, path = self._which_manager(path)
        return manager.trust_notebook(path)

    def check_and_sign(self, nb, path=''):
        """Check for trusted cells, and sign the notebook.

        Called as a part of saving notebooks.

        Parameters
        ----------
        nb : dict
            The notebook dict
        path : string
            The notebook's path (for logging)
        """
        manager, path = self._which_manager(path)
        return manager.check_and_sign(nb, path)

    def mark_trusted_cells(self, nb, path=''):
        """Mark cells as trusted if the notebook signature matches.

        Called as a part of loading notebooks.

        Parameters
        ----------
        nb : dict
            The notebook object (in current nbformat)
        path : string
            The notebook's path (for logging)
        """
        manager, path = self._which_manager(path)
        return manager.mark_trusted_cells(nb, path)

    def should_list(self, name):
        """Should this file/directory name be displayed in a listing?"""
        manager, name = self._which_manager(name)
        return manager.should_list(name)

    # Part 3: Checkpoints API
    def create_checkpoint(self, path):
        """Create a checkpoint."""
        manager, path = self._which_manager(path)
        return manager.create_checkpoint(path)

    def restore_checkpoint(self, checkpoint_id, path):
        """
        Restore a checkpoint.
        """
        manager, path = self._which_manager(path)
        return manager.restore_checkpoint(checkpoint_id, path)

    def list_checkpoints(self, path):
        manager, path = self._which_manager(path)
        return manager.list_checkpoints(path)

    def delete_checkpoint(self, checkpoint_id, path):
        manager, path = self._which_manager(path)
        return manager.delete_checkpoint(checkpoint_id, path)
