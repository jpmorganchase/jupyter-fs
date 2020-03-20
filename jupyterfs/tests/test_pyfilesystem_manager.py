# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#

import boto3
from jupyterfs.pyfilesystem_manager import PyFilesystemContentsManager

test_bucket = 'test'
test_contents = 'foo/nbar/nbaz'
test_endpoint_url = 'http://127.0.0.1:9000'
test_fname = 'foo.txt'


def _s3Client():
    return boto3.client(
        's3',
        endpoint_url=test_endpoint_url,
        # aws_access_key_id=test_cred,
        # aws_secret_access_key=test_cred,
        # region_name=self.region,
    )


def _s3ContentsManager():
    s3Uri = 's3://{bucket}?endpoint_url={endpoint_url}'.format(bucket=test_bucket, endpoint_url=test_endpoint_url)
    return PyFilesystemContentsManager.open_fs(s3Uri)


class TestPyFilesystemContentsManagerS3:
    def setup_method(self, method):
        s3client = _s3Client()

        # create a test bucket
        s3client.create_bucket(Bucket=test_bucket)

    def teardown_method(self, method):
        s3client = _s3Client()

        # delete all buckets
        for bucket in s3client.list_buckets():
            for key in bucket.objects.all():
                key.delete()
            bucket.delete()

    def test_write_s3_read_s3(self):
        s3CM = _s3ContentsManager()

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
        s3CM.save(test_contents, fpaths[0])
        s3CM.save(test_contents, fpaths[1])
        s3CM.save(test_contents, fpaths[2])

        # read and check
        assert test_contents == s3CM.get(fpaths[0])
        assert test_contents == s3CM.get(fpaths[1])
        assert test_contents == s3CM.get(fpaths[2])

    # @classmethod
    # def setup_class(cls):
    #     pass

    # @classmethod
    # def teardown_class(cls):
    #     pass
