import sys
from pathlib import Path

import pytest

from jupyterfs import fs, fs_instance


@pytest.fixture
def pyfs_instance():
    return fs(f"osfs://{str(Path(__file__).parent.resolve())}", "pyfs")


@pytest.fixture
def fsspec_instance():
    return fs(f"local://{str(Path(__file__).parent.resolve())}", "fsspec")


class TestFSWrapper:
    @pytest.mark.parametrize("helper", [fs, fs_instance])
    @pytest.mark.parametrize("kwargs", [{}, {"type": "fsspec"}])
    def test_osfs_alias_without_pyfilesystem(self, tmp_path, monkeypatch, helper, kwargs):
        monkeypatch.setitem(sys.modules, "fs", None)
        sample = tmp_path / "sample.txt"
        sample.write_text("local file content", encoding="utf-8")

        inst = helper(f"osfs://{tmp_path}", **kwargs)

        assert inst.read_text(str(sample)) == "local file content"

    def test_osfs_alias_preserves_storage_options(self, tmp_path):
        inst = fs(f"osfs://{tmp_path}", auto_mkdir=True)

        inst.write_text("nested/sample.txt", "local file content")

        assert (tmp_path / "nested" / "sample.txt").read_text(encoding="utf-8") == "local file content"

    @pytest.mark.parametrize(
        "fs_url,type", [(f"osfs://{str(Path(__file__).parent.resolve())}", "pyfs"), (f"local://{str(Path(__file__).parent.resolve())}", "fsspec")]
    )
    def test_methods(self, fs_url, type):
        inst = fs(fs_url=fs_url, type=type)
        assert inst.exists("test_fs_wrapper.py")
        assert inst.isfile("test_fs_wrapper.py")
        assert inst.isdir("")
        assert inst.listdir("")
        assert inst.ls("")
        assert inst.read_text("test_fs_wrapper.py")
        assert inst.read_bytes("test_fs_wrapper.py")
        assert inst.open("test_fs_wrapper.py")

    def test_equivalence(self, pyfs_instance, fsspec_instance):
        assert pyfs_instance.read_text("test_fs_wrapper.py") == fsspec_instance.read_text("test_fs_wrapper.py")
        assert pyfs_instance.read_bytes("test_fs_wrapper.py") == fsspec_instance.read_bytes("test_fs_wrapper.py")
        assert pyfs_instance.open("test_fs_wrapper.py").read() == fsspec_instance.open("test_fs_wrapper.py").read()
        assert pyfs_instance.ls(".") == fsspec_instance.ls(".")
        assert pyfs_instance.listdir(".") == fsspec_instance.listdir(".")
