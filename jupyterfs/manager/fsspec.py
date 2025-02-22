# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
import mimetypes
from base64 import decodebytes, encodebytes
from datetime import datetime
from pathlib import PurePosixPath

import nbformat
from jupyter_server.services.contents.filemanager import FileContentsManager
from tornado import web
from traitlets import default

from .checkpoints import NullCheckpoints
from .common import EPOCH_START, FileSystemLoadError

__all__ = ("FSSpecManager",)


class FSSpecManager(FileContentsManager):
    root = ""

    def __init__(self, fs, *args, default_writable=True, parent=None, **kwargs):
        super().__init__(parent=parent)
        import fsspec

        self._default_writable = default_writable
        if isinstance(fs, str):
            # fs is an fsspec url
            self._fs, root = fsspec.core.url_to_fs(fs, **kwargs)
            self.root = root

            # prune trailing slash
            if self.root.endswith("/"):
                self.root = self.root[:-1]

            # Run this once but don't worry about the result,
            # this is just to ensure the connection to the
            # backend service works.
            # In case it lazily connects, we want to not
            # show the file browser if the backend is broken.
            try:
                self._fs.isdir(self.root)
            except Exception as e:
                # Wrap the potentially backend-dependent exception
                # in a generic RuntimeError
                raise RuntimeError(f"Could not connect to fs {fs}") from e

            # Ensure that the user has chosen a root directory that exists
            if self.root.count("/") > 1 and not self._fs.exists(self.root) and not self._fs.isdir(self.root):
                raise RuntimeError(f"Root {self.root} does not exist in fs {fs}")

        else:
            raise TypeError("fs must be a url, an FS subclass, or an FS instance")

    @staticmethod
    def create(*args, **kwargs):
        try:
            return FSSpecManager(*args, **kwargs)
        except (RuntimeError, TypeError, ValueError) as e:
            # reraise as common error
            raise FileSystemLoadError from e

    @default("checkpoints_class")
    def _checkpoints_class_default(self):
        return NullCheckpoints

    def _normalize_path(self, path):
        if path and self._fs.root_marker and not path.startswith(self._fs.root_marker):
            path = f"{self._fs.root_marker}{path}"
        if path and not path.startswith(self.root):
            path = f"{self.root}/{path}"
        path = path or self.root

        # Fix any differences due to root markers
        path = path.replace("//", "/")

        # TODO better carveouts
        # S3 doesn't like spaces in paths
        if self._fs.__class__.__name__.startswith("S3"):
            path = path.replace(" ", "_")

        return path

    def _is_path_hidden(self, path):
        """Does the specific API style path correspond to a hidden node?
        Args:
            path (str): The path to check.
        Returns:
            hidden (bool): Whether the path is hidden.
        """
        # We treat entries with leading . in the name as hidden (unix convention)
        # We can (and should) check this even if the path does not exist
        if PurePosixPath(path).name.startswith("."):
            return True

        # TODO PyFilesystem implementation does more, perhaps we should as well
        return False

    def is_hidden(self, path):
        """Does the API style path correspond to a hidden directory or file?
        Args:
            path (str): The path to check.
        Returns:
            hidden (bool): Whether the path exists and is hidden.
        """
        path = self._normalize_path(path)
        ppath = PurePosixPath(path)
        # Path checks are quick, so we do it first to avoid unnecessary stat calls
        if any(part.startswith(".") for part in ppath.parts):
            return True
        while ppath.parents:
            if self._is_path_hidden(str(path)):
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
        path = self._normalize_path(path)
        return self._fs.isfile(path)

    def dir_exists(self, path):
        """Does the API-style path refer to an extant directory?
        Args:
            path (str): The path to check. This is an API path (`/` separated, relative to root_dir).
        Returns:
            exists (bool): Whether the path is indeed a directory.
        """
        path = self._normalize_path(path)
        return self._fs.isdir(path)

    def exists(self, path):
        """Returns True if the path exists, else returns False.
        Args:
            path (str): The API path to the file (with '/' as separator)
        Returns:
            exists (bool): Whether the target exists.
        """
        path = self._normalize_path(path)
        return self._fs.exists(path)

    def _base_model(self, path):
        """Build the common base of a contents model"""

        try:
            model = self._fs.info(path).copy()
        except FileNotFoundError:
            model = {"type": "file", "size": 0}
        model["name"] = path.rstrip("/").rsplit("/", 1)[-1]
        model["path"] = path.replace(self.root, "", 1)
        model["last_modified"] = datetime.fromtimestamp(model["mtime"]).isoformat() if "mtime" in model else EPOCH_START
        model["created"] = datetime.fromtimestamp(model["created"]).isoformat() if "created" in model else EPOCH_START
        model["content"] = None
        model["format"] = None
        model["mimetype"] = mimetypes.guess_type(path)[0]
        model["writable"] = True

        # get rid of size if directory, not accurate
        if model["type"] == "directory":
            model.pop("size", None)
        if model["name"].endswith(".ipynb"):
            model["type"] = "notebook"
        return model

    def _dir_model(self, path, content=True):
        """Build a model for a directory
        if content is requested, will include a listing of the directory
        """
        model = self._base_model(path)

        four_o_four = "directory does not exist: %r" % path

        if not self.allow_hidden and self.is_hidden(path):
            self.log.debug("Refusing to serve hidden directory %r, via 404 Error", path)
            raise web.HTTPError(404, four_o_four)

        if content:
            files = self._fs.ls(path, detail=True, refresh=True)
            model["content"] = [self._base_model(f["name"]) for f in files if self.allow_hidden or not self.is_hidden(f["name"])]
            model["format"] = "json"
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
        try:
            bcontent = self._fs.cat(path)
        except OSError as e:
            raise web.HTTPError(400, path, reason=str(e))

        if format is None or format == "text":
            # Try to interpret as unicode if format is unknown or if unicode
            # was explicitly requested.
            try:
                return bcontent.decode("utf8"), "text"
            except (UnicodeError, UnicodeDecodeError):
                if format == "text":
                    raise web.HTTPError(
                        400,
                        "%s is not UTF-8 encoded" % path,
                        reason="bad format",
                    )
        return encodebytes(bcontent).decode("ascii"), "base64"

    def _read_notebook(self, path, as_version=4):
        """Read a notebook from a path."""
        nb, format = self._read_file(path, "text")
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
        model["type"] = "file"
        model["mimetype"] = mimetypes.guess_type(path)[0]

        if content:
            content, format = self._read_file(path, format)
            if model["mimetype"] is None:
                default_mime = {"text": "text/plain", "base64": "application/octet-stream"}[format]
                model["mimetype"] = default_mime

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
        try:
            model = self._base_model(path)
        except FileNotFoundError:
            # bare model
            model = {}
            model["name"] = path.rsplit("/", 1)[-1]
            model["path"] = path
            model["last_modified"] = EPOCH_START
            model["created"] = EPOCH_START
            model["content"] = None
            model["format"] = None
            model["mimetype"] = None
            model["size"] = 0
            model["writable"] = True

        model["type"] = "notebook"
        if content:
            nb = self._read_notebook(path, as_version=4)
            self.mark_trusted_cells(nb, path)
            model["content"] = nb
            model["format"] = "json"
            self.validate_notebook_model(model)
        return model

    def get(self, path, content=True, type=None, format=None):
        """Takes a path for an entity and returns its model
        Args:
            path (str): the API path that describes the relative path for the target
            content (bool): Whether to include the contents in the reply
            type (str): The requested type - 'file', 'notebook', or 'directory'. Will raise HTTPError 400 if the content doesn't match.
            format (str): The requested format for file contents. 'text' or 'base64'. Ignored if this returns a notebook or directory model.
        Returns
            model (dict): the contents model. If content=True, returns the contents of the file or directory as well.
        """
        path = self._normalize_path(path)

        try:
            if self._fs.isdir(path):
                model = self._dir_model(path, content=content)
            elif type == "notebook" or (type is None and path.endswith(".ipynb")):
                model = self._notebook_model(path, content=content)
            else:
                model = self._file_model(path, content=content, format=format)
        except Exception as e:
            raise web.HTTPError(400, path, reason=str(e))

        return model

    def _save_directory(self, path, model):
        """create a directory"""
        if not self.allow_hidden and self.is_hidden(path):
            raise web.HTTPError(400, f"Cannot create directory {path!r}")

        if not self.exists(path):
            # TODO better carveouts
            if self._fs.__class__.__name__.startswith("S3"):
                # need to make a file temporarily
                # use the convention of a hidden file
                self._fs.touch(f"{path}/.s3fskeep")
            else:
                self._fs.mkdir(path)
        elif not self._fs.isdir(path):
            raise web.HTTPError(400, "Not a directory: %s" % (path))
        else:
            self.log.debug("Directory %r already exists", path)

    def _save_notebook(self, path, nb):
        """Save a notebook to an os_path."""
        s = nbformat.writes(nb, version=nbformat.NO_CONVERT)
        self._fs.pipe(path, s.encode())

    def _save_file(self, path, content, format):
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
        self._fs.pipe(path, bcontent)

    def save(self, model, path=""):
        """Save the file model and return the model with no content."""
        path = self._normalize_path(path)

        self.run_pre_save_hook(model=model, path=path)

        try:
            if model["type"] == "notebook":
                nb = nbformat.from_dict(model["content"])
                self.check_and_sign(nb, path)
                self._save_notebook(path, nb)
            elif model["type"] == "file":
                # Missing format will be handled internally by _save_file.
                self._save_file(path, model["content"], model.get("format"))
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

        self.run_post_save_hook(model=model, os_path=path)

        return model

    def delete_file(self, path):
        """Delete file at path."""
        path = self._normalize_path(path)
        self._fs.rm(path, recursive=True)

    def rename_file(self, old_path, new_path):
        """Rename a file."""
        old_path = self._normalize_path(old_path).strip("/")
        new_path = self._normalize_path(new_path).strip("/")
        if new_path == old_path:
            return

        # Should we proceed with the move?
        if self.exists(new_path):  # TODO and not samefile(old_os_path, new_os_path):
            raise web.HTTPError(409, "File already exists: %s" % new_path)

        # Move the file
        try:
            self._fs.mv(old_path, new_path)
        except web.HTTPError:
            raise
        except Exception as e:
            raise web.HTTPError(500, "Unknown error renaming file: %s %s" % (old_path, e))
