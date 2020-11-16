# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
from base64 import encodebytes, decodebytes
from datetime import datetime
from fs import errors, open_fs
from fs.base import FS
import mimetypes
import os.path
from tornado import web

import nbformat
from notebook import _tz as tz
from notebook.services.contents.checkpoints import Checkpoints
from notebook.services.contents.filecheckpoints import GenericFileCheckpoints
from notebook.services.contents.filemanager import FileContentsManager
from traitlets import default

__all__ = ["FSManager"]


EPOCH_START = datetime(1970, 1, 1, 0, 0, tzinfo=tz.UTC)

class FSManager(FileContentsManager):
    """This class bridges the gap between Pyfilesystem's filesystem class,
    and Jupyter Notebook's ContentsManager class. This allows Jupyter to
    leverage all the backends available in Pyfilesystem.

    Pyfilesystem methods (https://docs.pyfilesystem.org/en/latest/implementers.html#essential-methods)

    The following methods MUST be implemented in a PyFilesystem interface.

        getinfo() Get info regarding a file or directory.
        listdir() Get a list of resources in a directory.
        makedir() Make a directory.
        openbin() Open a binary file.
        remove() Remove a file.
        removedir() Remove a directory.
        setinfo() Set resource information.

    The following methods MAY be implemented in a PyFilesystem interface.

        appendbytes()
        appendtext()
        close()
        copy()
        copydir()
        create()
        desc()
        download()
        exists()
        filterdir()
        getmeta()
        getospath()
        getsize()
        getsyspath()
        gettype()
        geturl()
        hassyspath()
        hasurl()
        isclosed()
        isempty()
        isdir()
        isfile()
        islink()
        lock()
        makedirs()
        move()
        movedir()
        open()
        opendir()
        readbytes()
        readtext()
        removetree()
        scandir()
        settimes()
        touch()
        upload()
        validatepath()
        writebytes()
        writefile()
        writetext()

    Jupyter Notebook contents API (https://jupyter-notebook.readthedocs.io/en/stable/extending/contents.html#writing-a-custom-contentsmanager)
    Required:
        ContentsManager.get(path[, content, type, …]):      Get a file or directory model.
        ContentsManager.save(model, path):                  Save a file or directory model to path.
        ContentsManager.delete_file(path):                  Delete the file or directory at path.
        ContentsManager.rename_file(old_path, new_path):    Rename a file or directory.
        ContentsManager.file_exists([path]):                Does a file exist at the given path?
        ContentsManager.dir_exists(path):                   Does a directory exist at the given path?
        ContentsManager.is_hidden(path):                    Is path a hidden directory or file?

    Checkpoints:
        Checkpoints.rename_checkpoint(checkpoint_id, …):            Rename a single checkpoint from old_path to new_path.
        Checkpoints.list_checkpoints(path):                         Return a list of checkpoints for a given file
        Checkpoints.delete_checkpoint(checkpoint_id, …):            Delete a checkpoint for a file
        GenericCheckpointsMixin.create_file_checkpoint(…):          Create a checkpoint of the current state of a file
        GenericCheckpointsMixin.create_notebook_checkpoint(nb, …):  Create a checkpoint of the current state of a file
        GenericCheckpointsMixin.get_file_checkpoint(…):             Get the content of a checkpoint for a non-notebook file.
        GenericCheckpointsMixin.get_notebook_checkpoint(…):         Get the content of a checkpoint for a notebook.
    """
    @classmethod
    def open_fs(cls, *args, **kwargs):
        return cls(open_fs(*args, **kwargs))

    @classmethod
    def init_fs(cls, pyfs_class, *args, **kwargs):
        return cls(pyfs_class(*args, **kwargs))

    def __init__(self, pyfs, *args, **kwargs):
        if isinstance(pyfs, str):
            # pyfs is an opener url
            self._pyfilesystem_instance = open_fs(pyfs, *args, **kwargs)
        elif isinstance(pyfs, type) and issubclass(pyfs, FS):
            # pyfs is an FS subclass
            self._pyfilesystem_instance = pyfs(*args, **kwargs)
        elif isinstance(pyfs, FS):
            # pyfs is a FS instance
            self._pyfilesystem_instance = pyfs
        else:
            raise TypeError("pyfs must be a url, an FS subclass, or an FS instance")

    @default('checkpoints_class')
    def _checkpoints_class_default(self):
        return NullCheckpoints

    def is_hidden(self, path):
        """Does the API style path correspond to a hidden directory or file?
        Args:
            path (str): The path to check.
        Returns:
            hidden (bool): Whether the path exists and is hidden.
        """
        # TODO hidden
        return self._pyfilesystem_instance.exists(path)

    def file_exists(self, path):
        """Returns True if the file exists, else returns False.
        Args:
            path (str): The relative path to the file (with '/' as separator)
        Returns:
            exists (bool): Whether the file exists.
        """
        return self._pyfilesystem_instance.isfile(path)

    def dir_exists(self, path):
        """Does the API-style path refer to an extant directory?
        Args:
            path (str): The path to check. This is an API path (`/` separated, relative to root_dir).
        Returns:
            exists (bool): Whether the path is indeed a directory.
        """
        return self._pyfilesystem_instance.isdir(path)

    def exists(self, path):
        """Returns True if the path exists, else returns False.
        Args:
            path (str): The API path to the file (with '/' as separator)
        Returns:
            exists (bool): Whether the target exists.
        """
        return self._pyfilesystem_instance.exists(path)

    def _base_model(self, path):
        """Build the common base of a contents model"""
        info = self._pyfilesystem_instance.getinfo(path, namespaces=['details', 'access'])

        try:
            # size of file
            size = info.size
        except (errors.MissingInfoNamespace,):
            self.log.warning('Unable to get size.')
            size = None

        # Use the Unix epoch as a fallback so we don't crash.
        try:
            last_modified = info.modified or EPOCH_START
        except (errors.MissingInfoNamespace,):
            self.log.warning('Invalid `modified` for %s', path)
            last_modified = EPOCH_START

        try:
            created = info.created or last_modified
        except (errors.MissingInfoNamespace,):
            self.log.warning('Invalid `created` for %s', path)
            created = EPOCH_START

        # Create the base model.
        model = {}
        model['name'] = path.rsplit('/', 1)[-1]
        model['path'] = path
        model['last_modified'] = last_modified
        model['created'] = created
        model['content'] = None
        model['format'] = None
        model['mimetype'] = None
        model['size'] = size

        try:
            model['writable'] = info.permissions.check('u_w')  # TODO check
        except (errors.MissingInfoNamespace,):
            # if relevant namespace is missing, assume writable
            # TODO: decide if this is wise
            model['writable'] = True
        except OSError:
            self.log.error("Failed to check write permissions on %s", path)
            model['writable'] = False
        except AttributeError:
            model['writable'] = False
        return model

    def _dir_model(self, path, content=True):
        """Build a model for a directory
        if content is requested, will include a listing of the directory
        """
        four_o_four = u'directory does not exist: %r' % path

        if not self._pyfilesystem_instance.isdir(path):
            raise web.HTTPError(404, four_o_four)
        # TODO hidden
        # elif is_hidden(os_path, self.root_dir) and not self.allow_hidden:
        #     self.log.info("Refusing to serve hidden directory %r, via 404 Error",
        #         os_path
        #     )
        #     raise web.HTTPError(404, four_o_four)

        model = self._base_model(path)
        model['type'] = 'directory'
        model['size'] = None
        if content:
            model['content'] = contents = []
            for name in self._pyfilesystem_instance.listdir(path):
                os_path = os.path.join(path, name)
                if (
                    not self._pyfilesystem_instance.islink(os_path) and
                    not self._pyfilesystem_instance.isfile(os_path) and
                    not self._pyfilesystem_instance.isdir(os_path)
                ):
                    self.log.debug("%s not a regular file", os_path)
                    continue

                if self.should_list(name):
                    # TODO hidden
                    # if self.allow_hidden or not is_file_hidden(os_path, stat_res=st):
                    contents.append(self.get(path='%s/%s' % (path, name), content=False))
            model['format'] = 'json'
        return model

    def _read_file(self, path, format):
        """Read a non-notebook file.
        Args:
            path (str): The path to be read.
            format (str):
                If 'text', the contents will be decoded as UTF-8.
                If 'base64', the raw bytes contents will be encoded as base64.
                If not specified, try to decode as UTF-8, and fall back to base64
        """
        if not self._pyfilesystem_instance.isfile(path):
            raise web.HTTPError(400, "Cannot read non-file %s" % path)

        bcontent = self._pyfilesystem_instance.readbytes(path)

        if format is None or format == 'text':
            # Try to interpret as unicode if format is unknown or if unicode
            # was explicitly requested.
            try:
                return bcontent.decode('utf8'), 'text'
            except UnicodeError:
                if format == 'text':
                    raise web.HTTPError(
                        400,
                        "%s is not UTF-8 encoded" % path,
                        reason='bad format',
                    )
        return encodebytes(bcontent).decode('ascii'), 'base64'

    def _read_notebook(self, path, as_version=4):
        """Read a notebook from a path."""
        nb, format = self._read_file(path, 'text')
        return nbformat.reads(nb, as_version=as_version)

    def _file_model(self, path, content=True, format=None):
        """Build a model for a file
        if content is requested, include the file contents.
        format:
          If 'text', the contents will be decoded as UTF-8.
          If 'base64', the raw bytes contents will be encoded as base64.
          If not specified, try to decode as UTF-8, and fall back to base64
        """
        model = self._base_model(path)
        model['type'] = 'file'
        model['mimetype'] = mimetypes.guess_type(path)[0]

        if content:
            content, format = self._read_file(path, format)
            if model['mimetype'] is None:
                default_mime = {
                    'text': 'text/plain',
                    'base64': 'application/octet-stream'
                }[format]
                model['mimetype'] = default_mime

            model.update(
                content=content,
                format=format,
            )

        return model

    def _notebook_model(self, path, content=True):
        """Build a notebook model
        if content is requested, the notebook content will be populated
        as a JSON structure (not double-serialized)
        """
        model = self._base_model(path)
        model['type'] = 'notebook'
        if content:
            nb = self._read_notebook(path, as_version=4)
            self.mark_trusted_cells(nb, path)
            model['content'] = nb
            model['format'] = 'json'
            self.validate_notebook_model(model)
        return model

    def get(self, path, content=True, type=None, format=None):
        """ Takes a path for an entity and returns its model
        Args:
            path (str): the API path that describes the relative path for the target
            content (bool): Whether to include the contents in the reply
            type (str): The requested type - 'file', 'notebook', or 'directory'. Will raise HTTPError 400 if the content doesn't match.
            format (str): The requested format for file contents. 'text' or 'base64'. Ignored if this returns a notebook or directory model.
        Returns
            model (dict): the contents model. If content=True, returns the contents of the file or directory as well.
        """
        path = path.strip('/')

        if not self.exists(path):
            raise web.HTTPError(404, u'No such file or directory: %s' % path)

        if self._pyfilesystem_instance.isdir(path):
            if type not in (None, 'directory'):
                raise web.HTTPError(400,
                                    u'%s is a directory, not a %s' % (path, type), reason='bad type')
            model = self._dir_model(path, content=content)
        elif type == 'notebook' or (type is None and path.endswith('.ipynb')):
            model = self._notebook_model(path, content=content)
        else:
            if type == 'directory':
                raise web.HTTPError(400,
                                    u'%s is not a directory' % path, reason='bad type')
            model = self._file_model(path, content=content, format=format)
        return model

    def _save_directory(self, path, model):
        """create a directory"""
        # TODO hidden
        # if is_hidden(path, self.root_dir) and not self.allow_hidden:
        #     raise web.HTTPError(400, u'Cannot create hidden directory %r' % path)
        if not self._pyfilesystem_instance.exists(path):
            self._pyfilesystem_instance.makedir(path)
        elif not self._pyfilesystem_instance.isdir(path):
            raise web.HTTPError(400, u'Not a directory: %s' % (path))
        else:
            self.log.debug("Directory %r already exists", path)

    def _save_notebook(self, path, nb):
        """Save a notebook to an os_path."""
        s = nbformat.writes(nb, version=nbformat.NO_CONVERT)
        self._pyfilesystem_instance.writetext(path, s)

    def _save_file(self, path, content, format):
        """Save content of a generic file."""
        if format not in {'text', 'base64'}:
            raise web.HTTPError(
                400,
                "Must specify format of file contents as 'text' or 'base64'",
            )
        try:
            if format == 'text':
                bcontent = content.encode('utf8')
            else:
                b64_bytes = content.encode('ascii')
                bcontent = decodebytes(b64_bytes)
        except Exception as e:
            raise web.HTTPError(
                400, u'Encoding error saving %s: %s' % (path, e)
            )

        if format == 'text':
            self._pyfilesystem_instance.writebytes(path, bcontent)
        else:
            self._pyfilesystem_instance.writebytes(path, bcontent)

    def save(self, model, path=''):
        """Save the file model and return the model with no content."""
        path = path.strip('/')

        if 'type' not in model:
            raise web.HTTPError(400, u'No file type provided')
        if 'content' not in model and model['type'] != 'directory':
            raise web.HTTPError(400, u'No file content provided')

        self.log.debug("Saving %s", path)
        self.run_pre_save_hook(model=model, path=path)

        try:
            if model['type'] == 'notebook':
                nb = nbformat.from_dict(model['content'])
                self.check_and_sign(nb, path)
                self._save_notebook(path, nb)
                # TODO: decide how to handle checkpoints for non-local fs.
                # For now, checkpoint pathing seems to be borked.
                # One checkpoint should always exist for notebooks.
                # if not self.checkpoints.list_checkpoints(path):
                #     self.create_checkpoint(path)
            elif model['type'] == 'file':
                # Missing format will be handled internally by _save_file.
                self._save_file(path, model['content'], model.get('format'))
            elif model['type'] == 'directory':
                self._save_directory(path, model)
            else:
                raise web.HTTPError(400, "Unhandled contents type: %s" % model['type'])
        except web.HTTPError:
            raise
        except Exception as e:
            self.log.error(u'Error while saving file: %s %s', path, e, exc_info=True)
            raise web.HTTPError(500, u'Unexpected error while saving file: %s %s' % (path, e))

        validation_message = None
        if model['type'] == 'notebook':
            self.validate_notebook_model(model)
            validation_message = model.get('message', None)

        model = self.get(path, content=False)
        if validation_message:
            model['message'] = validation_message

        self.run_post_save_hook(model=model, os_path=path)

        return model

    def delete_file(self, path):
        """Delete file at path."""
        path = path.strip('/')
        if not self._pyfilesystem_instance.exists(path):
            raise web.HTTPError(404, u'File or directory does not exist: %s' % path)

        def is_non_empty_dir(os_path):
            if self._pyfilesystem_instance.isdir(path):
                # A directory containing only leftover checkpoints is
                # considered empty.
                cp_dir = getattr(self.checkpoints, 'checkpoint_dir', None)
                if set(self._pyfilesystem_instance.listdir(path)) - {cp_dir}:
                    return True
            return False

        if self._pyfilesystem_instance.isdir(path):
            # Don't permanently delete non-empty directories.
            if is_non_empty_dir(path):
                raise web.HTTPError(400, u'Directory %s not empty' % path)
            self.log.debug("Removing directory %s", path)
            self._pyfilesystem_instance.removetree(path)
        else:
            self.log.debug("Unlinking file %s", path)
            self._pyfilesystem_instance.remove(path)

    def rename_file(self, old_path, new_path):
        """Rename a file."""
        old_path = old_path.strip('/')
        new_path = new_path.strip('/')
        if new_path == old_path:
            return

        # Should we proceed with the move?
        if self._pyfilesystem_instance.exists(new_path):  # TODO and not samefile(old_os_path, new_os_path):
            raise web.HTTPError(409, u'File already exists: %s' % new_path)

        # Move the file
        try:
            self._pyfilesystem_instance.move(old_path, new_path)
        except web.HTTPError:
            raise
        except Exception as e:
            raise web.HTTPError(500, u'Unknown error renaming file: %s %s' % (old_path, e))


class PyFilesystemCheckpoints(GenericFileCheckpoints):
    pass

class NullCheckpoints(Checkpoints):
    def null_checkpoint(self):
        """Return a null checkpoint."""
        return dict(
            id="checkpoint",
            last_modified=""
        )

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
