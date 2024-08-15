# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
from base64 import encodebytes, decodebytes
from contextlib import contextmanager
from datetime import datetime
from fs import errors, open_fs
from fs.base import FS
from fs.errors import NoSysPath, ResourceNotFound, PermissionDenied
import mimetypes
import pathlib
import stat
from tornado import web

import nbformat
from jupyter_server import _tz as tz
from jupyter_server.services.contents.checkpoints import Checkpoints
from jupyter_server.services.contents.filecheckpoints import GenericFileCheckpoints
from jupyter_server.services.contents.filemanager import FileContentsManager
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

    @contextmanager
    def perm_to_403(self, path=None):
        """context manager for turning permission errors into 403."""
        try:
            yield
        except PermissionDenied as e:
            path = path or e.path or "unknown file"
            raise web.HTTPError(403, "Permission denied: %r" % path) from e

    def __init__(self, pyfs, *args, default_writable=True, parent=None, **kwargs):
        super().__init__(parent=parent)
        self._default_writable = default_writable
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

    @default("checkpoints_class")
    def _checkpoints_class_default(self):
        return NullCheckpoints

    def _is_path_hidden(self, path, info):
        """Does the specific API style path correspond to a hidden node?
        Args:
            path (str): The path to check.
            info (<Info>): FS Info object for file/dir at path
        Returns:
            hidden (bool): Whether the path is hidden.
        """
        # We do not know the OS of the actual FS, so let us be careful

        # We treat entries with leading . in the name as hidden (unix convention)
        # We can (and should) check this even if the path does not exist
        if pathlib.PurePosixPath(path).name.startswith("."):
            return True

        try:
            if not info:
                info = self._pyfilesystem_instance.getinfo(path, namespaces=("stat",))

            # Check Windows flag:
            if info.get("stat", "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_HIDDEN:
                return True
            # Check Mac flag
            if info.get("stat", "st_flags", 0) & stat.UF_HIDDEN:
                return True
            if info.get("basic", "is_dir"):
                # The `access` namespace does not have the facilities for actually checking
                # whether the current user can read/exec the dir, so we use systempath
                import os

                syspath = self._pyfilesystem_instance.getsyspath(path)
                if os.path.exists(syspath) and not os.access(syspath, os.X_OK | os.R_OK):
                    return True

        except ResourceNotFound:
            pass  # if path does not exist (and no leading .), it is not considered hidden
        except NoSysPath:
            pass  # if we rely on syspath, and FS does not have it, assume not hidden
        except PermissionDenied:
            pass  # if we are not allowed to stat the object, we treat it as if it is visible
        except Exception:
            self.log.exception(f"Failed to check if path is hidden: {path!r}")
        return False

    def is_hidden(self, path, info=None):
        """Does the API style path correspond to a hidden directory or file?
        Args:
            path (str): The path to check.
            info (<Info>): FS Info object for file/dir at path
        Returns:
            hidden (bool): Whether the path or any of its parents are hidden.
        """
        ppath = pathlib.PurePosixPath(path)
        # Path checks are quick, so we do it first to avoid unnecessary stat calls
        if any(part.startswith(".") for part in ppath.parts):
            return True
        while ppath.parents:
            if self._is_path_hidden(str(path), info):
                return True
            ppath = ppath.parent
        return False

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

    def _base_model(self, path, info):
        """
        Build the common base of a contents model

        info (<Info>): FS Info object for file/dir at path -- used for values and reduces needed network calls
        """
        try:
            # size of file
            size = info.size
        except (errors.MissingInfoNamespace,):
            size = None

        # Use the Unix epoch as a fallback so we don't crash.
        try:
            last_modified = info.modified or EPOCH_START
        except (errors.MissingInfoNamespace,):
            last_modified = EPOCH_START

        try:
            created = info.created or last_modified
        except (errors.MissingInfoNamespace,):
            created = EPOCH_START

        # Create the base model.
        model = {}
        model["name"] = info.name
        model["path"] = path
        model["last_modified"] = last_modified
        model["created"] = created
        model["content"] = None
        model["format"] = None
        model["mimetype"] = None
        model["size"] = size

        try:
            # The `access` namespace does not have the facilities for actually checking
            # whether the current user can read/exec the dir, so we use systempath
            # and do a syscall. This is slightly expensive, so ideally we could avoid this
            import os

            syspath = self._pyfilesystem_instance.getsyspath(path)
            model["writable"] = os.access(syspath, os.W_OK)

        except NoSysPath:
            try:
                # Fall back on "u_w" check, even if we don't know if our user == owner...
                model["writable"] = info.permissions.check("u_w")
            except (errors.MissingInfoNamespace, AttributeError):
                # use default if access namespace is missing
                model["writable"] = self._default_writable
        except (OSError, PermissionDenied):
            self.log.error("Failed to check write permissions on %s", path)
            model["writable"] = False
        except AttributeError:
            model["writable"] = False
        return model

    def _dir_model(self, path, info, content=True):
        """Build a model for a directory
        if content is requested, will include a listing of the directory
        info (<Info>): FS Info object for file/dir at path
        """
        four_o_four = "directory does not exist: %r" % path

        if not info.is_dir:
            raise web.HTTPError(404, four_o_four)

        elif not self.allow_hidden and self.is_hidden(path, info):
            self.log.debug("Refusing to serve hidden directory %r, via 404 Error", path)
            raise web.HTTPError(404, four_o_four)

        model = self._base_model(path, info)
        model["type"] = "directory"
        model["size"] = None
        if content:
            model["content"] = contents = []

            for dir_entry in self._pyfilesystem_instance.scandir(path, namespaces=("basic", "access", "details", "stat")):
                try:
                    if self.should_list(dir_entry.name):
                        if self.allow_hidden or not self._is_path_hidden(dir_entry.make_path(path), dir_entry):
                            contents.append(
                                self.get(
                                    path="%s/%s" % (path, dir_entry.name),
                                    content=False,
                                    info=dir_entry,
                                )
                            )
                except PermissionDenied:
                    pass  # Don't provide clues about protected files
                except web.HTTPError:
                    # ignore http errors: they are already logged, and shouldn't prevent
                    # us from listing other entries
                    pass
                except Exception as e:
                    self.log.warning("Error stat-ing %s: %s", dir_entry.make_path(path), e)

            model["format"] = "json"
        return model

    def _read_file(self, path, format, info):
        """Read a non-notebook file.
        Args:
            path (str): The path to be read.
            format (str):
                If 'text', the contents will be decoded as UTF-8.
                If 'base64', the raw bytes contents will be encoded as base64.
                If not specified, try to decode as UTF-8, and fall back to base64
            info (<Info>): FS Info object for file at path
        """
        with self.perm_to_403(path):
            if not info.is_file:
                raise web.HTTPError(400, "Cannot read non-file %s" % path)

            bcontent = self._pyfilesystem_instance.readbytes(path)

        if format is None or format == "text":
            # Try to interpret as unicode if format is unknown or if unicode
            # was explicitly requested.
            try:
                return bcontent.decode("utf8"), "text"
            except UnicodeError:
                if format == "text":
                    raise web.HTTPError(
                        400,
                        "%s is not UTF-8 encoded" % path,
                        reason="bad format",
                    )
        return encodebytes(bcontent).decode("ascii"), "base64"

    def _read_notebook(self, path, info, as_version=4):
        """Read a notebook from a path."""
        nb, format = self._read_file(path, "text", info)
        return nbformat.reads(nb, as_version=as_version)

    def _file_model(self, path, info, content=True, format=None):
        """Build a model for a file
        if content is requested, include the file contents.
        format:
          If 'text', the contents will be decoded as UTF-8.
          If 'base64', the raw bytes contents will be encoded as base64.
          If not specified, try to decode as UTF-8, and fall back to base64

        info (<Info>): FS Info object for file at path
        """
        model = self._base_model(path, info)
        model["type"] = "file"
        model["mimetype"] = mimetypes.guess_type(path)[0]

        if content:
            content, format = self._read_file(path, format, info)
            if model["mimetype"] is None:
                default_mime = {
                    "text": "text/plain",
                    "base64": "application/octet-stream",
                }[format]
                model["mimetype"] = default_mime

            model.update(
                content=content,
                format=format,
            )

        return model

    def _notebook_model(self, path, info, content=True):
        """Build a notebook model
        if content is requested, the notebook content will be populated
        as a JSON structure (not double-serialized)
        info (<Info>): FS Info object for file at path
        """
        model = self._base_model(path, info)
        model["type"] = "notebook"
        if content:
            nb = self._read_notebook(path, info, as_version=4)
            self.mark_trusted_cells(nb, path)
            model["content"] = nb
            model["format"] = "json"
            self.validate_notebook_model(model)
        return model

    def get(self, path, content=True, type=None, format=None, info=None):
        """Takes a path for an entity and returns its model
        Args:
            path (str): the API path that describes the relative path for the target
            content (bool): Whether to include the contents in the reply
            type (str): The requested type - 'file', 'notebook', or 'directory'.
                Will raise HTTPError 400 if the content doesn't match.
            format (str):
                The requested format for file contents. 'text' or 'base64'. Ignored if this returns a notebook or directory model.
            info (fs Info object):
                Optional FS Info. If present, it needs to include the following namespaces: "basic", "stat", "access", "details".
                Including it can avoid extraneous networkcalls.
        Returns
            model (dict): the contents model. If content=True, returns the contents of the file or directory as well.
        """
        path = path.strip("/")

        # gather info - by doing here can minimise further network requests from underlying fs functions
        if not info:
            try:
                info = self._pyfilesystem_instance.getinfo(path, namespaces=("basic", "stat", "access", "details"))
            except Exception:
                raise web.HTTPError(404, "No such file or directory: %s" % path)

        if info.is_dir:
            if type not in (None, "directory"):
                raise web.HTTPError(400, "%s is a directory, not a %s" % (path, type), reason="bad type")
            model = self._dir_model(path, content=content, info=info)
        elif type == "notebook" or (type is None and path.endswith(".ipynb")):
            model = self._notebook_model(path, content=content, info=info)
        else:
            if type == "directory":
                raise web.HTTPError(400, "%s is not a directory" % path, reason="bad type")
            model = self._file_model(path, content=content, format=format, info=info)
        return model

    def _save_directory(self, path, model):
        """create a directory"""
        with self.perm_to_403(path):
            if not self.allow_hidden and self.is_hidden(path):
                raise web.HTTPError(400, f"Cannot create directory {path!r}")
            if not self._pyfilesystem_instance.exists(path):
                self._pyfilesystem_instance.makedir(path)
            elif not self._pyfilesystem_instance.isdir(path):
                raise web.HTTPError(400, "Not a directory: %s" % (path))
            else:
                self.log.debug("Directory %r already exists", path)

    def _save_notebook(self, path, nb):
        """Save a notebook to an os_path."""
        s = nbformat.writes(nb, version=nbformat.NO_CONVERT)
        with self.perm_to_403(path):
            self._pyfilesystem_instance.writetext(path, s)

    def _save_file(self, path, content, format, chunk=None):
        """Save content of a generic file."""
        if format not in {"text", "base64"}:
            raise web.HTTPError(
                400,
                "Must specify format of file contents as 'text' or 'base64'",
            )
        try:
            if format == "text":
                bcontent = content.encode("utf8")
            else:
                b64_bytes = content.encode("ascii")
                bcontent = decodebytes(b64_bytes)
        except Exception as e:
            raise web.HTTPError(400, "Encoding error saving %s: %s" % (path, e))

        with self.perm_to_403(path):
            # Overwrite content if unchunked or for the first chunk
            if chunk is None or chunk == 1:
                self._pyfilesystem_instance.writebytes(path, bcontent)
            else:
                self._pyfilesystem_instance.appendbytes(path, bcontent)

    def save(self, model, path=""):
        """Save the file model and return the model with no content."""
        path = path.strip("/")

        if "type" not in model:
            raise web.HTTPError(400, "No file type provided")
        if "content" not in model and model["type"] != "directory":
            raise web.HTTPError(400, "No file content provided")

        chunk = model.get("chunk", None)
        if chunk and model["type"] != "file":
            raise web.HTTPError(
                400,
                'File type "{}" is not supported for chunked transfer'.format(model["type"]),
            )

        self.log.debug("Saving %s", path)
        if chunk is None or chunk == 1:
            self.run_pre_save_hooks(model=model, path=path)

        try:
            if model["type"] == "notebook":
                nb = nbformat.from_dict(model["content"])
                self.check_and_sign(nb, path)
                self._save_notebook(path, nb)
                # TODO: decide how to handle checkpoints for non-local fs.
                # For now, checkpoint pathing seems to be borked.
                # One checkpoint should always exist for notebooks.
                # if not self.checkpoints.list_checkpoints(path):
                #     self.create_checkpoint(path)
            elif model["type"] == "file":
                # Missing format will be handled internally by _save_file.
                self._save_file(path, model["content"], model.get("format"), chunk)
            elif model["type"] == "directory":
                self._save_directory(path, model)
            else:
                raise web.HTTPError(400, "Unhandled contents type: %s" % model["type"])
        except web.HTTPError:
            raise
        except Exception as e:
            self.log.error("Error while saving file: %s %s", path, e, exc_info=True)
            raise web.HTTPError(500, "Unexpected error while saving file: %s %s" % (path, e))

        validation_message = None
        if model["type"] == "notebook":
            self.validate_notebook_model(model)
            validation_message = model.get("message", None)

        model = self.get(path, content=False)
        if validation_message:
            model["message"] = validation_message

        if chunk is None or chunk == -1:
            self.run_post_save_hooks(model=model, os_path=path)

        return model

    def _is_non_empty_dir(self, path):
        if self._pyfilesystem_instance.isdir(path):
            # A directory containing only leftover checkpoints is
            # considered empty.
            cp_dir = getattr(self.checkpoints, "checkpoint_dir", None)
            if set(self._pyfilesystem_instance.listdir(path)) - {cp_dir}:
                return True
        return False

    def delete_file(self, path):
        """Delete file at path."""
        path = path.strip("/")

        with self.perm_to_403(path):
            if not self._pyfilesystem_instance.exists(path):
                raise web.HTTPError(404, "File or directory does not exist: %s" % path)

            if self._pyfilesystem_instance.isdir(path):
                # Don't permanently delete non-empty directories.
                if self._is_non_empty_dir(path):
                    raise web.HTTPError(400, "Directory %s not empty" % path)
                self.log.debug("Removing directory %s", path)
                self._pyfilesystem_instance.removetree(path)
            else:
                self.log.debug("Unlinking file %s", path)
                self._pyfilesystem_instance.remove(path)

    def rename_file(self, old_path, new_path):
        """Rename a file or directory."""
        old_path = old_path.strip("/")
        new_path = new_path.strip("/")
        if new_path == old_path:
            return

        with self.perm_to_403(new_path):
            # Should we proceed with the move?
            if self._pyfilesystem_instance.exists(new_path):  # TODO and not samefile(old_os_path, new_os_path):
                raise web.HTTPError(409, "File already exists: %s" % new_path)

        # Move the file or directory
        try:
            with self.perm_to_403():
                if self.dir_exists(old_path):
                    self.log.debug("Renaming directory %s to %s", old_path, new_path)
                    self._pyfilesystem_instance.movedir(old_path, new_path, create=True)
                else:
                    self.log.debug("Renaming file %s to %s", old_path, new_path)
                    self._pyfilesystem_instance.move(old_path, new_path)
        except web.HTTPError:
            raise
        except Exception as e:
            raise web.HTTPError(500, "Unknown error renaming file: %s %s" % (old_path, e))


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
