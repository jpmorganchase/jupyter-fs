# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.

import os
import shutil
import socket
from contextlib import nullcontext
from itertools import product
from pathlib import Path
from shutil import which

import pytest
import tornado.web

from .utils import s3, samba
from .utils.client import ContentsClient

test_dir = "test"
test_content = "foo\nbar\nbaz"
test_fname = "foo.txt"

test_root_osfs = "osfs_local"

# test_url_s3 = "http://127.0.0.1/"
test_url_s3 = f"http://{socket.gethostname().replace('.local', '')}"
test_port_s3 = "9000"

test_host_smb_docker_share = socket.gethostbyname(socket.gethostname())
test_hostname_smb_docker_share = "test"
test_name_port_smb_docker_nameport = 4137
test_name_port_smb_docker_share = 4139

test_direct_tcp_smb_os_share = False
test_host_smb_os_share = socket.gethostbyname_ex(socket.gethostname())[2][-1]
test_smb_port_smb_os_share = 139

_test_file_model = {
    "content": test_content,
    "format": "text",
    "mimetype": "text/plain",
    "name": test_fname,
    "path": test_fname,
    "type": "file",
    "writable": True,
}

configs = [
    {
        "ServerApp": {
            "jpserver_extensions": {"jupyterfs.extension": True},
            "contents_manager_class": "jupyterfs.metamanager.MetaManager",
        },
        "ContentsManager": {"allow_hidden": True},
    },
    {
        "ServerApp": {
            "jpserver_extensions": {"jupyterfs.extension": True},
            "contents_manager_class": "jupyterfs.metamanager.MetaManager",
        },
        "ContentsManager": {"allow_hidden": False},
    },
]


class _TestBase:
    """Contains tests universal to all PyFilesystemContentsManager flavors"""

    @pytest.mark.parametrize("jp_server_config,resource_type", list(product(configs, ["pyfs", "fsspec"])))
    async def test_write_read(self, jp_fetch, jp_server_config, resource_type, tmp_path):
        allow_hidden = jp_server_config["ContentsManager"]["allow_hidden"]

        cc = ContentsClient(jp_fetch)

        resource = self.get_resource(resource_type, tmp_path)
        resources = await cc.set_resources([resource])
        drive = resources[0]["drive"]

        fpaths = [
            f"{drive}:{test_fname}",
            f"{drive}:root0/{test_fname}",
            f"{drive}:root1/leaf1/{test_fname}",
        ]

        hidden_paths = [
            f"{drive}:root1/leaf1/.hidden.txt",
            f"{drive}:root1/.leaf1/also_hidden.txt",
        ]

        # set up dir structure
        await cc.mkdir(f"{drive}:root0")
        await cc.mkdir(f"{drive}:root1")
        await cc.mkdir(f"{drive}:root1/leaf1")
        if allow_hidden:
            await cc.mkdir(f"{drive}:root1/.leaf1")

        for p in fpaths:
            # save to root and tips
            await cc.save(p, _test_file_model)
            # read and check
            assert test_content == (await cc.get(p))["content"]

        for p in hidden_paths:
            ctx = nullcontext() if allow_hidden else pytest.raises(tornado.httpclient.HTTPClientError)
            with ctx as c:
                # save to root and tips
                await cc.save(p, _test_file_model)
                # read and check
                assert test_content == (await cc.get(p))["content"]

            if not allow_hidden:
                assert c.value.code == 400


class Test_FSManager_osfs(_TestBase):
    """No extra setup required for this test suite"""

    _test_dir = str(Path(test_root_osfs) / Path(test_dir))

    @classmethod
    def setup_class(cls):
        shutil.rmtree(test_root_osfs, ignore_errors=True)
        os.makedirs(test_root_osfs)

    def setup_method(self, method):
        os.makedirs(self._test_dir)

    def teardown_method(self, method):
        shutil.rmtree(self._test_dir, ignore_errors=True)

    def get_resource(self, resource_type, tmp_path=None):
        if resource_type == "pyfs":
            return {"url": f"osfs://{tmp_path}", "type": resource_type}
        elif resource_type == "fsspec":
            return {"url": f"file://{tmp_path}", "type": resource_type}


@pytest.mark.skipif(which("docker") is None, reason="requires docker")
class Test_FSManager_s3(_TestBase):
    """Tests on an instance of s3proxy running in a docker
    Manual startup of equivalent docker:

        docker run --rm -p 9000:80 --env S3PROXY_AUTHORIZATION=none andrewgaul/s3proxy
    """

    _rootDirUtil = s3.RootDirUtil(dir_name=test_dir, port=test_port_s3, url=test_url_s3)

    @classmethod
    def setup_class(cls):
        # delete any existing root
        cls._rootDirUtil.delete()

    @classmethod
    def teardown_class(cls): ...

    def setup_method(self, method):
        self._rootDirUtil.create()

    def teardown_method(self, method):
        self._rootDirUtil.delete()

    def get_resource(self, resource_type, tmp_path=None):
        if resource_type == "pyfs":
            uri = "s3://{id}:{key}@{bucket}?endpoint_url={url}:{port}".format(
                id=s3.aws_access_key_id,
                key=s3.aws_secret_access_key,
                bucket=test_dir,
                url=test_url_s3.strip("/"),
                port=test_port_s3,
            )
            return {"url": uri, "type": resource_type}
        elif resource_type == "fsspec":
            uri = f"s3://{test_dir}"
            return {
                "url": uri,
                "type": resource_type,
                "kwargs": {
                    "key": s3.aws_access_key_id,
                    "secret": s3.aws_secret_access_key,
                    "endpoint_url": f"{test_url_s3}:{test_port_s3}",
                    "default_cache_type": "none",
                },
            }


@pytest.mark.darwin
@pytest.mark.linux
@pytest.mark.skipif(which("docker") is None, reason="requires docker")
class Test_FSManager_smb_docker_share(_TestBase):
    """(mac/linux only. future: windows) runs its own samba server via
    py-docker. Automatically creates and exposes a share from a docker
    container.

    Manual startup of equivalent docker:

        docker run --rm -it -p 137:137/udp -p 138:138/udp -p 139:139 -p 445:445 dperson/samba -p -n -u "smbuser;smbuser" -w "TESTNET"

    Docker with a windows guest:

        docker run --rm -it -p 137:137/udp -p 138:138/udp -p 139:139 -p 445:445 mcr.microsoft.com/windows/nanoserver:1809
    """

    _rootDirUtil = samba.RootDirUtil(
        dir_name=test_dir,
        host=test_host_smb_docker_share,
        hostname=test_hostname_smb_docker_share,
        name_port=test_name_port_smb_docker_nameport,
        smb_port=test_name_port_smb_docker_share,
    )

    @classmethod
    def setup_class(cls):
        # delete any existing root
        cls._rootDirUtil.delete()

    @classmethod
    def teardown_class(cls): ...

    def setup_method(self, method):
        # create a root
        self._rootDirUtil.create()

    def teardown_method(self, method):
        # delete any existing root
        self._rootDirUtil.delete()

    def get_resource(self, resource_type, tmp_path=None):
        if resource_type == "pyfs":
            uri = "smb://{username}:{passwd}@{host}:{smb_port}/{share}?name-port={name_port}".format(
                username=samba.smb_user,
                passwd=samba.smb_passwd,
                host=test_host_smb_docker_share,
                share=test_hostname_smb_docker_share,
                smb_port=test_name_port_smb_docker_share,
                name_port=test_name_port_smb_docker_nameport,
            )
        elif resource_type == "fsspec":
            uri = "smb://{username}:{passwd}@{host}:{smb_port}/{share}".format(
                username=samba.smb_user,
                passwd=samba.smb_passwd,
                host=test_host_smb_docker_share,
                share=test_hostname_smb_docker_share,
                smb_port=test_name_port_smb_docker_share,
            )
        return {"url": uri, "type": resource_type}


# @pytest.mark.darwin
# @pytest.mark.win32
# class Test_FSManager_smb_os_share(_TestBase):
#     """(windows only. future: also mac) Uses the os's buitlin samba server.
#     Expects a local user "smbuser" with access to a share named "test"
#     """

#     _rootDirUtil = samba.RootDirUtil(
#         dir_name=test_dir,
#         host=test_host_smb_os_share,
#         smb_port=test_smb_port_smb_os_share,
#     )

#     @classmethod
#     def setup_class(cls):
#         # delete any existing root
#         cls._rootDirUtil.delete()

#     def setup_method(self, method):
#         # create a root
#         self._rootDirUtil.create()

#     def teardown_method(self, method):
#         # delete any existing root
#         self._rootDirUtil.delete()

#    @pytest.fixture
#    def resource_uri(self):
#         kwargs = dict(
#             direct_tcp=test_direct_tcp_smb_os_share,
#             host=test_host_smb_os_share,
#             hostname=socket.gethostname(),
#             passwd=samba.smb_passwd,
#             share=test_dir,
#             username=samba.smb_user,
#         )

#         if test_smb_port_smb_os_share is not None:
#             uri = "smb://{username}:{passwd}@{host}:{port}/{share}?hostname={hostname}&direct-tcp={direct_tcp}".format(
#                 port=test_smb_port_smb_os_share, **kwargs
#             )
#         else:
#             uri = "smb://{username}:{passwd}@{host}/{share}?hostname={hostname}&direct-tcp={direct_tcp}".format(
#                 **kwargs
#             )

#        yield uri
