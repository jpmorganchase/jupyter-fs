# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#

import boto3
import botocore
from jupyterfs.pyfilesystem_manager import PyFilesystemContentsManager

test_aws_access_key_id = 's3_local'
test_aws_secret_access_key = 's3_local'
test_bucket = 'test'
test_content = 'foo\nbar\nbaz'
test_endpoint_url = 'http://127.0.0.1:9000'
test_fname = 'foo.txt'

_boto_kw = dict(
    config=botocore.client.Config(signature_version=botocore.UNSIGNED),
    endpoint_url=test_endpoint_url,
)

_test_file_model = {
    'content': test_content,
    'format': 'text',
    'mimetype': 'text/plain',
    'name': test_fname,
    'path': test_fname,
    'type': 'file',
    'writable': True,
}


def _s3Resource():
    return boto3.resource('s3', **_boto_kw)


def _s3BucketExists(bucket_name):
    s3Resource = _s3Resource()

    # check if bucket already exists
    bucket_exists = True
    try:
        s3Resource.meta.client.head_bucket(Bucket=bucket_name)
    except botocore.exceptions.ClientError as e:
        # If it was a 404 error, then the bucket does not exist.
        error_code = e.response['Error']['Code']
        if error_code == '404':
            bucket_exists = False

    return bucket_exists


def _s3CreateBucket(bucket_name):
    if not _s3BucketExists(bucket_name):
        # create the bucket
        _s3Resource().create_bucket(Bucket=bucket_name)


def _s3DeleteBucket(bucket_name):
    if _s3BucketExists(bucket_name):
        bucket = _s3Resource().Bucket(bucket_name)

        # delete the bucket
        for key in bucket.objects.all():
            key.delete()
        bucket.delete()


def _s3ContentsManager():
    s3Uri = 's3://{aws_access_key_id}:{aws_secret_access_key}@{bucket}?endpoint_url={endpoint_url}'.format(
        aws_access_key_id=test_aws_access_key_id,
        aws_secret_access_key=test_aws_secret_access_key,
        bucket=test_bucket,
        endpoint_url=test_endpoint_url
    )

    return PyFilesystemContentsManager.open_fs(s3Uri)


class TestPyFilesystemContentsManagerS3:
    @classmethod
    def setup_class(cls):
        _s3DeleteBucket(test_bucket)

    def setup_method(self, method):
        _s3CreateBucket(test_bucket)

    def teardown_method(self, method):
        _s3DeleteBucket(test_bucket)

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
        s3CM.save(_test_file_model, fpaths[0])
        s3CM.save(_test_file_model, fpaths[1])
        s3CM.save(_test_file_model, fpaths[2])

        # read and check
        assert test_content == s3CM.get(fpaths[0])['content']
        assert test_content == s3CM.get(fpaths[1])['content']
        assert test_content == s3CM.get(fpaths[2])['content']

    # @classmethod
    # def teardown_class(cls):
    #     pass
