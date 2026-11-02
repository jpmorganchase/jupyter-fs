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

        monkeypatch.setattr(filesystem, "getinfo", protected_getinfo)
        assert [entry["name"] for entry in FSManager(filesystem).get("")["content"]] == ["healthy"]


def test_listing_propagates_directory_error(monkeypatch):
    with MemoryFS() as filesystem:

        def failed_listdir(path):
            raise OperationFailed(path)

        monkeypatch.setattr(filesystem, "listdir", failed_listdir)
        with pytest.raises(OperationFailed):
            FSManager(filesystem).get("")
