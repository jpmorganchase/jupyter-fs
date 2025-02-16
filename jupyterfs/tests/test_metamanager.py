# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.

import pytest
from traitlets.config import Config

from .utils.client import ContentsClient

# base config
base_config = {
    "ServerApp": {
        "jpserver_extensions": {"jupyterfs.extension": True},
        "contents_manager_class": "jupyterfs.metamanager.MetaManager",
    },
    "JupyterFs": {},
}

sync_base_config = {
    "ServerApp": {
        "jpserver_extensions": {"jupyterfs.extension": True},
        "contents_manager_class": "jupyterfs.metamanager.SyncMetaManager",
    },
    "JupyterFs": {},
}

deny_client_config = {
    "JupyterFs": {
        "allow_user_resources": False,
    }
}


@pytest.fixture
def tmp_osfs_resource():
    """parametrize if we want tmp resource"""
    return False


@pytest.fixture
def our_config():
    """parametrize if we want custom config"""
    return {}


@pytest.fixture
def jp_server_config(base_config, tmp_path, tmp_osfs_resource, our_config):
    c = Config(base_config)
    c.JupyterFs.setdefault("resources", [])
    if tmp_osfs_resource:
        c.JupyterFs.resources.extend(
            [
                # pyfilesystem
                {
                    "name": "test-server-config",
                    "url": f"osfs://{tmp_path.as_posix()}",
                },
                # fsspec
                {
                    "name": "test-server-config",
                    "url": f"local://{tmp_path.as_posix()}",
                    "type": "fsspec",
                },
            ]
        )
    c.merge(Config(our_config))
    return c


@pytest.mark.parametrize("base_config", [base_config, sync_base_config])
@pytest.mark.parametrize("our_config", [deny_client_config])
@pytest.mark.parametrize("fs", ["local", "osfs"])
async def test_client_creation_disallowed(tmp_path, jp_fetch, jp_server_config, fs):
    cc = ContentsClient(jp_fetch)
    resources = await cc.set_resources([{"name": "test-2", "url": f"{fs}://{tmp_path.as_posix()}"}])
    assert resources == []


@pytest.mark.parametrize("base_config", [base_config, sync_base_config])
@pytest.mark.parametrize("our_config", [deny_client_config])
@pytest.mark.parametrize("tmp_osfs_resource", [True])
@pytest.mark.parametrize("fs", ["local", "osfs"])
async def test_client_creation_disallowed_retains_server_config(tmp_path, jp_fetch, jp_server_config, fs):
    cc = ContentsClient(jp_fetch)
    resources = await cc.set_resources([{"name": "test-2", "url": f"{fs}://{tmp_path.as_posix()}"}])
    names = set(map(lambda r: r["name"], resources))
    assert names == {"test-server-config"}


@pytest.mark.parametrize("base_config", [base_config, sync_base_config])
@pytest.mark.parametrize(
    "our_config",
    [
        {
            "JupyterFs": {
                "resource_validators": [
                    r"osfs://.*/test-valid-A.*",
                    r"local://.*/test-valid-A.*",
                    r".*://.*/test-valid-B",
                ]
            }
        }
    ],
)
@pytest.mark.parametrize("fs", ["local", "osfs"])
async def test_resource_validators(tmp_path, jp_fetch, jp_server_config, fs):
    cc = ContentsClient(jp_fetch)
    (tmp_path / "test-valid-A").mkdir()
    (tmp_path / "test-valid-B").mkdir()
    (tmp_path / "test-invalid-A").mkdir()
    (tmp_path / "test-invalid-B").mkdir()
    (tmp_path / "invalid-C").mkdir()
    type = "fsspec" if fs == "local" else None
    resources = await cc.set_resources(
        [
            {"name": "valid-1", "type": type, "url": f"{fs}://{tmp_path.as_posix()}/test-valid-A"},
            {"name": "valid-2", "type": type, "url": f"{fs}://{tmp_path.as_posix()}/test-valid-B"},
            {
                "name": "invalid-1",
                "type": type,
                "url": f"{fs}://{tmp_path.as_posix()}/test-invalid-A",
            },
            {
                "name": "invalid-2",
                "type": type,
                "url": f"{fs}://{tmp_path.as_posix()}/test-invalid-B",
            },
            {"name": "invalid-3", "type": type, "url": f"{fs}://{tmp_path.as_posix()}/invalid-C"},
            {"name": "invalid-4", "type": type, "url": f"{fs}://{tmp_path.as_posix()}/foo"},
            {
                "name": "invalid-5",
                "type": type,
                "url": f"{fs}://{tmp_path.as_posix()}/test-valid-A/non-existant",
            },
            {
                "name": "invalid-6",
                "type": type,
                "url": f"non-existant://{tmp_path.as_posix()}/test-valid-B",
            },
        ]
    )
    names = {r["name"] for r in resources if r["init"]}
    assert names == {"valid-1", "valid-2"}


@pytest.mark.parametrize("base_config", [base_config, sync_base_config])
@pytest.mark.parametrize(
    "our_config",
    [
        {
            "JupyterFs": {
                "resource_validators": [
                    r"osfs://([^@]*|[^:]*[:][@].*)",  # no auth, or at least no password
                    r"osfs://",  # sanity check that this doesn't change the result
                    r"local://([^@]*|[^:]*[:][@].*)",  # no auth, or at least no password
                    r"local://",  # sanity check that this doesn't change the result
                ]
            }
        }
    ],
)
@pytest.mark.parametrize("fs", ["local", "osfs"])
async def test_resource_validators_no_auth(tmp_path, jp_fetch, jp_server_config, fs):
    cc = ContentsClient(jp_fetch)
    resources = await cc.set_resources(
        [
            {"name": "valid-1", "url": f"{fs}://{tmp_path.as_posix()}"},
            {"name": "valid-2", "url": f"{fs}://username:@{tmp_path.as_posix()}"},
            {"name": "invalid-1", "url": f"{fs}://username:pwd@{tmp_path.as_posix()}"},
            {"name": "invalid-2", "url": f"{fs}://:pwd@{tmp_path.as_posix()}"},
        ]
    )
    names = set(map(lambda r: r["name"], resources))
    assert names == {"valid-1", "valid-2"}


@pytest.mark.parametrize("base_config", [base_config, sync_base_config])
@pytest.mark.parametrize("our_config", [{}])
async def test_basic_sanity_check(tmp_path, jp_fetch, jp_server_config):
    cc = ContentsClient(jp_fetch)
    resources = await cc.get("/")
    assert resources["type"] == "directory"
