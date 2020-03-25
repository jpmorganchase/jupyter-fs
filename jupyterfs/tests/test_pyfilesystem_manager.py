# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#

from jupyterfs.pyfilesystem_manager import PyFilesystemContentsManager

from .utils.s3 import aws_access_key_id, aws_secret_access_key, BucketUtil

test_bucket_name = 'test'
test_content = 'foo\nbar\nbaz'
test_fname = 'foo.txt'

test_endpoint_url_s3 = 'http://127.0.0.1:9000'

_test_file_model = {
    'content': test_content,
    'format': 'text',
    'mimetype': 'text/plain',
    'name': test_fname,
    'path': test_fname,
    'type': 'file',
    'writable': True,
}


class TestPyFilesystemContentsManager_s3:
    """Before running this test, first run:

        docker run -p 9000:80 --env S3PROXY_AUTHORIZATION=none andrewgaul/s3proxy

    in order to set up the test S3 server
    """
    _bucketUtil = BucketUtil(bucket_name=test_bucket_name, endpoint_url=test_endpoint_url_s3)

    @staticmethod
    def _s3ContentsManager():
        s3Uri = 's3://{id}:{key}@{bucket}?endpoint_url={endpoint_url}'.format(
            id=aws_access_key_id,
            key=aws_secret_access_key,
            bucket=test_bucket_name,
            endpoint_url=test_endpoint_url_s3
        )

        return PyFilesystemContentsManager.open_fs(s3Uri)

    @classmethod
    def setup_class(cls):
        cls._bucketUtil.delete()

    def setup_method(self, method):
        self._bucketUtil.create()

    def teardown_method(self, method):
        self._bucketUtil.delete()

    def test_write_read(self):
        s3CM = self._s3ContentsManager()

        fpaths = [
            '' + test_fname,
            'root0/' + test_fname,
            'root1/leaf1/' + test_fname
        ]

        # set up dir structure
        s3CM._save_directory('root0', None)
        s3CM._save_directory('root1', None)
        s3CM._save_directory('root1/leaf1', None)

        # save to root and tips
        s3CM.save(_test_file_model, fpaths[0])
        s3CM.save(_test_file_model, fpaths[1])
        s3CM.save(_test_file_model, fpaths[2])

        # read and check
        assert test_content == s3CM.get(fpaths[0])['content']
        assert test_content == s3CM.get(fpaths[1])['content']
        assert test_content == s3CM.get(fpaths[2])['content']
