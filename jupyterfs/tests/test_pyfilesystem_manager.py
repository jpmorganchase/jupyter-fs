# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.

from pathlib import Path
import os
import shutil

from jupyterfs.pyfilesystem_manager import PyFilesystemContentsManager

from .utils import s3, smb

test_dir = 'test'
test_content = 'foo\nbar\nbaz'
test_fname = 'foo.txt'

test_endpoint_url_s3 = 'http://127.0.0.1:9000'
test_endpoint_url_smb = '127.0.0.1'
test_root_osfs = 'osfs_local'

_test_file_model = {
    'content': test_content,
    'format': 'text',
    'mimetype': 'text/plain',
    'name': test_fname,
    'path': test_fname,
    'type': 'file',
    'writable': True,
}


class _TestBase:
    """Contains tests universal to all PyFilesystemContentsManager flavors
    """
    def _createContentsManager(self):
        raise NotImplementedError

    def testWriteRead(self):
        cm = self._createContentsManager()

        fpaths = [
                '' + test_fname,
                'root0/' + test_fname,
                'root1/leaf1/' + test_fname
            ]

        # set up dir structure
        cm._save_directory('root0', None)
        cm._save_directory('root1', None)
        cm._save_directory('root1/leaf1', None)

        # save to root and tips
        cm.save(_test_file_model, fpaths[0])
        cm.save(_test_file_model, fpaths[1])
        cm.save(_test_file_model, fpaths[2])

        # read and check
        assert test_content == cm.get(fpaths[0])['content']
        assert test_content == cm.get(fpaths[1])['content']
        assert test_content == cm.get(fpaths[2])['content']


class TestPyFilesystemContentsManager_osfs(_TestBase):
    """No extra setup required for this test suite
    """
    _test_dir = str(Path(test_root_osfs) / Path(test_dir))

    @classmethod
    def setup_class(cls):
        shutil.rmtree(test_root_osfs, ignore_errors=True)
        os.makedirs(test_root_osfs)

    def setup_method(self, method):
        os.makedirs(self._test_dir)

    def teardown_method(self, method):
        shutil.rmtree(self._test_dir, ignore_errors=True)

    def _createContentsManager(self):
        uri = 'osfs://{local_dir}'.format(local_dir=self._test_dir)

        return PyFilesystemContentsManager.open_fs(uri)


class TestPyFilesystemContentsManager_s3(_TestBase):
    """Before running this test, first run:

        docker run -p 9000:80 --env S3PROXY_AUTHORIZATION=none andrewgaul/s3proxy

    in order to set up the test S3 server
    """
    _rootDirUtil = s3.RootDirUtil(dir_name=test_dir, endpoint_url=test_endpoint_url_s3)

    @classmethod
    def setup_class(cls):
        cls._rootDirUtil.delete()

    def setup_method(self, method):
        self._rootDirUtil.create()

    def teardown_method(self, method):
        self._rootDirUtil.delete()

    def _createContentsManager(self):
        uri = 's3://{id}:{key}@{bucket}?endpoint_url={endpoint_url}'.format(
            id=s3.aws_access_key_id,
            key=s3.aws_secret_access_key,
            bucket=test_dir,
            endpoint_url=test_endpoint_url_s3
        )

        return PyFilesystemContentsManager.open_fs(uri)


# class TestPyFilesystemContentsManager_smb(_TestBase):
#     """
#     """
#     _rootDirUtil = smb.RootDirUtil(dir_name=test_dir, endpoint_url=test_endpoint_url_smb)

#     @classmethod
#     def setup_class(cls):
#         cls._rootDirUtil.delete()

#     def setup_method(self, method):
#         self._rootDirUtil.create()

#     def teardown_method(self, method):
#         self._rootDirUtil.delete()

#     def _createContentsManager(self):
#         uri = 'smb://{id}:{key}@{endpoint_url}'.format(
#             id=smb.smb_user,
#             key=smb.smb_pswd,
#             endpoint_url=test_endpoint_url_smb
#         )

#         return PyFilesystemContentsManager.open_fs(uri)
