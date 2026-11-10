import pytest
from fs.errors import DirectoryExpected, OperationFailed, PermissionDenied, RemoteConnectionError, ResourceNotFound
from fs.memoryfs import MemoryFS
from fs.osfs import OSFS

from jupyterfs.manager.fs import FSManager, _is_child_metadata_listing_error


@pytest.mark.parametrize("path", ["", "nested"])
@pytest.mark.parametrize("allow_hidden", [False, True])
def test_listing_with_broken_symlink(tmp_path, path, allow_hidden):
    directory = tmp_path / path
    directory.mkdir(exist_ok=True)
    # A broken link must not prevent listing any of its healthy siblings.
    (directory / "broken").symlink_to("missing")
    (directory / "healthy.txt").write_text("healthy")
    (directory / ".hidden.txt").write_text("hidden")
    (directory / "folder").mkdir()
    (directory / "file-link").symlink_to("healthy.txt")
    (directory / "directory-link").symlink_to("folder", target_is_directory=True)
    with OSFS(str(tmp_path)) as filesystem:
        manager = FSManager(filesystem)
        manager.allow_hidden = allow_hidden
        model = manager.get(path)
        entries = {entry["name"]: entry for entry in model["content"]}
        expected = {"healthy.txt", "folder", "file-link", "directory-link"}
        if allow_hidden:
            expected.add(".hidden.txt")
        assert entries.keys() == expected
        assert model["format"] == "json"
        assert entries["file-link"]["type"] == "file"
        assert entries["file-link"]["size"] == len("healthy")
        assert entries["directory-link"]["type"] == "directory"
        assert manager.get(f"{path}/file-link")["content"] == "healthy"
        assert all(entry["content"] is None for entry in entries.values())


def test_listing_uses_bulk_scandir_on_healthy_path(monkeypatch):
    with MemoryFS() as filesystem:
        filesystem.writetext("a.txt", "a")
        filesystem.writetext("b.txt", "b")
        filesystem.makedir("folder")
        filesystem.writetext(".hidden.txt", "hidden")

        orig_scandir = filesystem.scandir
        orig_listdir = filesystem.listdir
        orig_getinfo = filesystem.getinfo
        scandir_calls = []
        listdir_calls = []
        getinfo_paths = []

        def scandir(path, namespaces=None, page=None):
            scandir_calls.append((path, tuple(namespaces or ())))
            return orig_scandir(path, namespaces=namespaces, page=page)

        def listdir(path):
            listdir_calls.append(path)
            return orig_listdir(path)

        def getinfo(path, namespaces=None):
            getinfo_paths.append(path)
            return orig_getinfo(path, namespaces=namespaces)

        monkeypatch.setattr(filesystem, "scandir", scandir)
        monkeypatch.setattr(filesystem, "listdir", listdir)
        monkeypatch.setattr(filesystem, "getinfo", getinfo)

        manager = FSManager(filesystem)
        manager.allow_hidden = False
        model = manager.get("")
        names = [entry["name"] for entry in model["content"]]

        assert set(names) == {"a.txt", "b.txt", "folder"}
        assert len(names) == 3
        assert len(scandir_calls) == 1
        assert scandir_calls[0][1] == ("basic", "access", "details", "stat")
        assert listdir_calls == []
        assert all(path.strip("/") == "" for path in getinfo_paths)


@pytest.mark.parametrize("position", ["first", "middle", "last"])
def test_listing_skips_broken_child_in_any_position(monkeypatch, position):
    names = ["alpha", "beta", "gamma"]
    broken = {"first": "alpha", "middle": "beta", "last": "gamma"}[position]
    with MemoryFS() as filesystem:
        for name in names:
            filesystem.writetext(name, name)

        orig_scandir = filesystem.scandir
        orig_getinfo = filesystem.getinfo

        def scandir(path, namespaces=None, page=None):
            def iterator():
                for dir_entry in orig_scandir(path, namespaces=namespaces, page=page):
                    if dir_entry.name == broken:
                        raise ResourceNotFound(path)
                    yield dir_entry

            return iterator()

        def getinfo(path, namespaces=None):
            if path.strip("/") == broken:
                raise ResourceNotFound(path)
            return orig_getinfo(path, namespaces=namespaces)

        monkeypatch.setattr(filesystem, "scandir", scandir)
        monkeypatch.setattr(filesystem, "getinfo", getinfo)

        listed = [entry["name"] for entry in FSManager(filesystem).get("")["content"]]
        assert listed == [name for name in names if name != broken]


def test_partial_scandir_failure_does_not_duplicate_entries(monkeypatch):
    with MemoryFS() as filesystem:
        filesystem.writetext("alpha", "a")
        filesystem.writetext("beta", "b")

        orig_scandir = filesystem.scandir
        orig_listdir = filesystem.listdir
        orig_getinfo = filesystem.getinfo
        listdir_calls = []
        getinfo_paths = []

        def scandir(path, namespaces=None, page=None):
            def iterator():
                for dir_entry in orig_scandir(path, namespaces=namespaces, page=page):
                    if dir_entry.name == "beta":
                        raise ResourceNotFound(path)
                    yield dir_entry

            return iterator()

        def listdir(path):
            listdir_calls.append(path)
            return orig_listdir(path)

        def getinfo(path, namespaces=None):
            getinfo_paths.append(path)
            return orig_getinfo(path, namespaces=namespaces)

        monkeypatch.setattr(filesystem, "scandir", scandir)
        monkeypatch.setattr(filesystem, "listdir", listdir)
        monkeypatch.setattr(filesystem, "getinfo", getinfo)

        names = [entry["name"] for entry in FSManager(filesystem).get("")["content"]]
        assert names == ["alpha", "beta"]
        assert len(names) == len(set(names))
        assert [path.strip("/") for path in listdir_calls] == [""]
        # getinfo is used for the parent and for children not already yielded.
        assert "beta" in {path.strip("/") for path in getinfo_paths}
        assert "alpha" not in {path.strip("/") for path in getinfo_paths}


def test_listing_skips_protected_entry(monkeypatch):
    with MemoryFS() as filesystem:
        filesystem.writetext("protected", "secret")
        filesystem.writetext("healthy", "healthy")
        orig_scandir = filesystem.scandir
        orig_getinfo = filesystem.getinfo

        def scandir(path, namespaces=None, page=None):
            def iterator():
                for dir_entry in orig_scandir(path, namespaces=namespaces, page=page):
                    if dir_entry.name == "protected":
                        raise PermissionDenied(path)
                    yield dir_entry

            return iterator()

        def getinfo(path, namespaces=None):
            if path.strip("/") == "protected":
                raise PermissionDenied(path)
            return orig_getinfo(path, namespaces=namespaces)

        monkeypatch.setattr(filesystem, "scandir", scandir)
        monkeypatch.setattr(filesystem, "getinfo", getinfo)
        assert [entry["name"] for entry in FSManager(filesystem).get("")["content"]] == ["healthy"]


def test_listing_skips_disappearing_child(monkeypatch):
    with MemoryFS() as filesystem:
        filesystem.writetext("vanished", "gone")
        filesystem.writetext("healthy", "healthy")
        orig_scandir = filesystem.scandir
        orig_getinfo = filesystem.getinfo

        def scandir(path, namespaces=None, page=None):
            def iterator():
                for dir_entry in orig_scandir(path, namespaces=namespaces, page=page):
                    if dir_entry.name == "vanished":
                        raise ResourceNotFound(path)
                    yield dir_entry

            return iterator()

        def getinfo(path, namespaces=None):
            if path.strip("/") == "vanished":
                raise ResourceNotFound(path)
            return orig_getinfo(path, namespaces=namespaces)

        monkeypatch.setattr(filesystem, "scandir", scandir)
        monkeypatch.setattr(filesystem, "getinfo", getinfo)
        assert [entry["name"] for entry in FSManager(filesystem).get("")["content"]] == ["healthy"]


@pytest.mark.parametrize(
    "error",
    [
        ResourceNotFound(""),
        PermissionDenied(""),
        DirectoryExpected(""),
        OperationFailed(""),
        RemoteConnectionError(""),
    ],
)
def test_listing_propagates_directory_error(monkeypatch, error):
    with MemoryFS() as filesystem:
        filesystem.writetext("healthy", "healthy")

        def failed_scandir(path, namespaces=None, page=None):
            raise error

        def failed_listdir(path):
            raise error

        monkeypatch.setattr(filesystem, "scandir", failed_scandir)
        monkeypatch.setattr(filesystem, "listdir", failed_listdir)
        with pytest.raises(type(error)):
            FSManager(filesystem).get("")


def test_listing_propagates_unrelated_backend_error_without_fallback(monkeypatch):
    with MemoryFS() as filesystem:
        filesystem.writetext("healthy", "healthy")
        listdir_calls = []

        def failed_scandir(path, namespaces=None, page=None):
            raise RemoteConnectionError(path)

        def listdir(path):
            listdir_calls.append(path)
            return ["healthy"]

        monkeypatch.setattr(filesystem, "scandir", failed_scandir)
        monkeypatch.setattr(filesystem, "listdir", listdir)
        with pytest.raises(RemoteConnectionError):
            FSManager(filesystem).get("")
        assert listdir_calls == []


def test_child_metadata_error_classifier():
    assert _is_child_metadata_listing_error(ResourceNotFound(""))
    assert _is_child_metadata_listing_error(PermissionDenied(""))
    assert _is_child_metadata_listing_error(OperationFailed(""))
    assert not _is_child_metadata_listing_error(RemoteConnectionError(""))
    assert not _is_child_metadata_listing_error(DirectoryExpected(""))
    assert not _is_child_metadata_listing_error(RuntimeError("boom"))
