#!/usr/bin/env python
# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.

import atexit
import docker
import os
import signal
import time

# get `smb` from pysmb, not from this file
import sys
_sys_path_front = sys.path.pop(0)
from smb.SMBConnection import SMBConnection
# undo changes to sys.path
sys.path.insert(0, _sys_path_front)

__all__ = ['smb_user', 'smb_pswd', 'startServer', 'RootDirUtil']

smb_user = 'smb_local'
smb_pswd = 'smb_local'

def startServer(ports=(('139/tcp', 139), ('137/udp', 137), ('445/tcp', 445))):
    docker_client = docker.from_env(version='auto')
    docker_client.info()

    smb_container = docker_client.containers.run(
        "pwntr/samba-alpine",
        detach=True,
        ports=dict(ports),
        remove=True,
        tmpfs={'/shared': 'size=3G,uid=1000'},
        tty=True,
        volumes={
            os.path.abspath(os.path.realpath(os.path.join(__file__, os.path.pardir, "smb.conf"))): {"bind": "/config/smb.conf", "mode": "ro"}
        }
    )

    atexit.register(smb_container.kill)
    # atexit.register(smb_container.remove)


class RootDirUtil:
    def __init__(
        self,
        dir_name,
        endpoint_url,
        my_name='local',
        remote_name='sambaalpine'
    ):
        self.dir_name = dir_name
        self.endpoint_url = endpoint_url
        self.my_name = my_name
        self.remote_name = remote_name

    def exists(self):
        conn = self.resource()

        return self.dir_name in conn.listShares()

    def create(self):
        """taken care of by smb.conf
        """
        pass

    def _delete(self, path, conn):
        for p in conn.listPath(self.dir_name, '.'):
            if p.filename!='.' and p.filename!='..':
                parentPath = path
                if not parentPath.endswith('/'):
                    parentPath += '/'

                if p.isDirectory:
                    self._delete(parentPath+p.filename, conn)
                    conn.deleteDirectory(self.dir_name, parentPath+p.filename)
                else:
                    conn.deleteFiles(self.dir_name, parentPath+p.filename)

    def delete(self):
        conn = self.resource()

        self._delete('.', conn)

    def resource(self):
        kwargs = dict(
            username=smb_user,
            password=smb_user,
            my_name=self.my_name,
            remote_name=self.remote_name
        )

        conn = SMBConnection(**kwargs)
        assert conn.connect(self.endpoint_url, 139)

        return conn


if __name__ == "__main__":
    def sigHandler(signo, frame):
        sys.exit(0)

    # make sure the docker cleanup runs on ctrl-c
    signal.signal(signal.SIGINT, sigHandler)
    # signal.signal(signal.SIGTERM, sigHandler)

    startServer()

    while True:
        time.sleep(10)
