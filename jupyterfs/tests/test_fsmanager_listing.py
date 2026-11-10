import pytest
from fs.errors import OperationFailed, PermissionDenied
from fs.memoryfs import MemoryFS
from fs.osfs import OSFS

from jupyterfs.manager.fs import FSManager


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


def test_listing_skips_protected_entry(monkeypatch):
    with MemoryFS() as filesystem:
        filesystem.writetext("protected", "secret")
        filesystem.writetext("healthy", "healthy")
        getinfo = filesystem.getinfo

        def protected_getinfo(path, namespaces=None):
            if path.strip("/") == "protected":
                raise PermissionDenied(path)
            return getinfo(path, namespaces=namespaces)

        def failing_scandir(path, namespaces=None, page=None):
            raise OperationFailed(path)

        # Force the entry-by-entry fallback, where per-entry errors are handled
        monkeypatch.setattr(filesystem, "scandir", failing_scandir)
        monkeypatch.setattr(filesystem, "getinfo", protected_getinfo)
        assert [entry["name"] for entry in FSManager(filesystem).get("")["content"]] == ["healthy"]


def test_listing_propagates_directory_error(monkeypatch):
    with MemoryFS() as filesystem:

        def failed_listdir(path):
            raise OperationFailed(path)

        def failed_scandir(path, namespaces=None, page=None):
            raise OperationFailed(path)

        monkeypatch.setattr(filesystem, "scandir", failed_scandir)
        monkeypatch.setattr(filesystem, "listdir", failed_listdir)
        with pytest.raises(OperationFailed):
            FSManager(filesystem).get("")


def test_listing_uses_scandir_without_per_entry_getinfo(monkeypatch):
    # Healthy directories keep the single-listing fast path (no per-entry round trip)
    with MemoryFS() as filesystem:
        filesystem.writetext("a", "a")
        filesystem.writetext("b", "b")

        def forbidden_getinfo(path, namespaces=None):
            if path.strip("/") in {"a", "b"}:
                raise AssertionError("per-entry getinfo used on the fast path")
            return MemoryFS.getinfo(filesystem, path, namespaces=namespaces)

        monkeypatch.setattr(filesystem, "getinfo", forbidden_getinfo)
        assert sorted(entry["name"] for entry in FSManager(filesystem).get("")["content"]) == ["a", "b"]
