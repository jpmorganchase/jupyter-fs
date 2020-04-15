# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.

import atexit
import boto3
import botocore
import docker
import time

__all__ = ['aws_access_key_id', 'aws_secret_access_key', 'RootDirUtil']

aws_access_key_id = 's3_local'
aws_secret_access_key = 's3_local'

def startServer(s3_port=9000):
    ports = {'80/tcp': s3_port}

    # init docker
    docker_client = docker.from_env(version='auto')
    docker_client.info()

    # run a docker container running s3proxy
    container = docker_client.containers.run(
        'andrewgaul/s3proxy',
        detach=True,
        environment={'S3PROXY_AUTHORIZATION': 'none'},
        ports=ports,
        remove=True,
        tty=True,
        # network_mode='host',
    )

    def exitHandler():
        try:
            # will raise docker.errors.NotFound if container does not currently exist
            docker_client.containers.get(container.id)

            container.kill()
            # container.remove()
        except docker.errors.NotFound:
            pass

    atexit.register(exitHandler)

    # wait for samba to start up
    timeout = 0
    while True:
        tail = container.logs(tail=1)
        if b"main o.g.s.o.e.jetty.server.Server" in tail and b"|::] Started @" in tail:
            break

        if timeout >= 100:
            raise RuntimeError('docker andrewgaul/s3proxy timed out while starting up')

        timeout += 1
        time.sleep(1)

    return container, exitHandler

class RootDirUtil:
    def __init__(
        self,
        dir_name,
        url,
        port,
    ):
        self.dir_name = dir_name
        self.url = url.rstrip('/')
        self.port = port

        self._container = None
        self._container_exit_handler = None
        self._endpoint_url = '{}:{}'.format(self.url, self.port)

    def exists(self):
        # check if bucket already exists
        bucket_exists = True
        try:
            self.resource().meta.client.head_bucket(Bucket=self.dir_name)
        except botocore.exceptions.ClientError as e:
            # If it was a 404 error, then the bucket does not exist.
            error_code = e.response['Error']['Code']
            if error_code == '404':
                bucket_exists = False

        return bucket_exists

    def create(self):
        if not self.exists():
            # create the bucket
            self.resource().create_bucket(Bucket=self.dir_name)

    def delete(self):
        if self.exists():
            bucket = self.resource().Bucket(self.dir_name)

            # walk the bucket from leaves to roots and delete as you go.
            # This avoids deleting non-empty s3 folders (extremely slow)
            for key in reversed(list(bucket.objects.all())):
                key.delete()

            # delete the bucket
            bucket.delete()

    def resource(self):
        boto_kw = dict(
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            # config=botocore.client.Config(signature_version=botocore.UNSIGNED),
            endpoint_url=self._endpoint_url,
        )

        return boto3.resource('s3', **boto_kw)

    def start(self):
        self._container, self._container_exit_handler = startServer(s3_port=self.port)

    def stop(self):
        if self._container is not None:
            self._container_exit_handler()

        self._container = None
        self._container_exit_handler = None
