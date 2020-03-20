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

def _s3client():
    return boto3.client(
    's3',
    endpoint_url=test_endpoint_url,
    # aws_access_key_id=test_cred,
    # aws_secret_access_key=test_cred,
    # region_name=self.region,
)

class TestPyFilesystemContentsManagerS3:
    def setup_method(self, method):
        s3 = _s3client()

        # create a test bucket
        s3.create_bucket(Bucket=test_bucket)

    def teardown_method(self, method):
        s3 = _s3client()

        # delete all buckets
        for bucket in s3.list_buckets():
            for key in bucket.objects.all():
                key.delete()
            bucket.delete()

    def test_write_s3_read_s3(self):
        s3man = PyFilesystemContentsManager.open_fs('s3://{bucket}?endpoint_url={endpoint_url}'.format(bucket=test_bucket, endpoint_url=test_endpoint_url))

        s3man.save(test_contents, test_fname)
        s3man._save_directory('root0', None)
        s3man._save_directory('root1', None)
        s3man._save_directory('root1/leaf1', None)
        s3man.save(test_contents, 'root0/{fname}'.format(fname=test_fname))
        s3man.save(test_contents, 'root1/leaf1{fname}'.format(fname=test_fname))



    # @classmethod
    # def setup_class(cls):
    #     pass

    # @classmethod
    # def teardown_class(cls):
    #     pass
