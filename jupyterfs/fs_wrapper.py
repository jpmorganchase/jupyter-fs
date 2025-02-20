def _fs_instance_and_root(fs_url, type="pyfs", **kwargs):
    """Wrapper around fs.open/fsspec.core.url_to_fs with {{variable}} substitution"""
    from .auth import stdin_prompt

    # substitute credential variables via `getpass` queries
    fs_url = stdin_prompt(fs_url)

    if type == "fsspec":
        import fsspec

        return fsspec.core.url_to_fs(fs_url, **kwargs)
    else:
        import fs

        return fs.opener.open(fs_url, **kwargs)


def fs_instance(fs_url, type="pyfs", **kwargs):
    return _fs_instance_and_root(fs_url=fs_url, type=type, **kwargs)[0]


class FSWrapper:
    """Helper wrapper class around PyFilesystem/fsspec instance to make
    some operations easier/unified for snippets"""

    def __init__(self, fs, type="pyfs", root=None):
        self.fs = fs
        self.type = type
        self.root = root
        if root and self.root.endswith("/"):
            self.root = self.root[:-1]

    def __enter__(self):
        if self.type == "pyfs":
            self.fs.__enter__()
        return self

    def __exit__(self, *args):
        if self.type == "pyfs":
            return self.fs.__exit__(*args)

    def _wrap_path(self, path):
        if self.type == "pyfs":
            return path
        # prune trailing slash
        if not path.startswith(self.fs.root_marker) and self.fs.root_marker:
            path = f"{self.fs.root_marker}{path}"
        elif not path.startswith("/"):
            path = f"/{path}"
        if not path.startswith(self.root):
            path = f"{self.root}{path}"
        return path

    def read_bytes(self, path):
        path = self._wrap_path(path)
        if self.type == "pyfs":
            return self.fs.readbytes(path)
        return self.fs.read_bytes(path)

    def readbytes(self, path):
        return self.read_bytes(path)

    def read_text(self, path):
        path = self._wrap_path(path)
        if self.type == "pyfs":
            return self.fs.readtext(path)
        return self.fs.read_text(path)

    def readtext(self, path):
        return self.read_text(path)

    def write_bytes(self, path, data):
        path = self._wrap_path(path)
        if self.type == "pyfs":
            return self.fs.writebytes(path, data)
        return self.fs.write_bytes(path, data)

    def writebytes(self, path, data):
        return self.write_bytes(path, data)

    def write_text(self, path, data):
        path = self._wrap_path(path)
        if self.type == "pyfs":
            return self.fs.writetext(path, data)
        return self.fs.write_text(path, data)

    def writetext(self, path, data):
        return self.write_text(path, data)

    def exists(self, path):
        path = self._wrap_path(path)
        return self.fs.exists(path)

    def isdir(self, path):
        path = self._wrap_path(path)
        return self.fs.isdir(path)

    def isfile(self, path):
        path = self._wrap_path(path)
        return self.fs.isfile(path)

    def listdir(self, path):
        path = self._wrap_path(path)
        if self.type == "pyfs":
            return self.fs.listdir(path)
        return [_.replace(self.root, "").replace("/./", "") for _ in self.fs.ls(path)]

    def ls(self, path):
        return self.listdir(path)

    def makedir(self, path):
        path = self._wrap_path(path)
        if self.type == "pyfs":
            return self.fs.makedir(path)
        return self.fs.mkdir(path)

    def mkdir(self, path):
        return self.makedir(path)

    def open(self, path, mode="r"):
        path = self._wrap_path(path)
        if self.type == "pyfs":
            return self.fs.open(path, mode)
        return self.fs.open(path, mode)

    def close(self):
        return self.fs.close()

    def instance(self):
        return self.fs


def fs(fs_url, type="pyfs", **kwargs):
    fs, root = _fs_instance_and_root(fs_url=fs_url, type=type, **kwargs)
    return FSWrapper(fs=fs, type=type, root=root)
