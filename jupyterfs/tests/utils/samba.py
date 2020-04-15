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
import shutil
import signal
from smb.SMBConnection import SMBConnection
import socket
import sys
import time

__all__ = ['smb_user', 'smb_passwd', 'startServer', 'RootDirUtil']

smb_user = 'smbuser'
smb_passwd = 'smbuser'

_dir = os.path.dirname(os.path.abspath(os.path.realpath(__file__)))


def startServer(name_port=137):
    ports = dict((
        ('137/udp', name_port),
        ('138/udp', 138),
        ('139/tcp', 139),
        ('445/tcp', 445),
    ))

    # init docker
    docker_client = docker.from_env(version='auto')
    docker_client.info()

    # set up smb.conf
    shutil.copy(os.path.join(_dir, 'smb.conf.template'), os.path.join(_dir, 'smb.conf'))

    # run the docker container
    smb_container = docker_client.containers.run(
        'dperson/samba', 'samba.sh -n -p -u "{user};{passwd}"'.format(user=smb_user, passwd=smb_passwd),
        detach=True,
        ports=ports,
        remove=True,
        tmpfs={'/shared': 'size=3G,uid=1000'},
        tty=True,
        volumes={
            os.path.join(_dir, "smb.conf"): {"bind": "/etc/samba/smb.conf", "mode": "rw"}
        },
        # network_mode='host',
    )

    def exitHandler():
        try:
            # will raise docker.errors.NotFound if container does not currently exist
            docker_client.containers.get(smb_container.id)

            smb_container.kill()
            # smb_container.remove()
        except docker.errors.NotFound:
            pass

    atexit.register(exitHandler)

    # wait for samba to start up
    timeout = 0
    while True:
        if b"daemon 'smbd' finished starting up" in smb_container.logs():
            break

        if timeout >= 100:
            raise RuntimeError('docker dperson/samba timed out while starting up')

        timeout += 1
        time.sleep(1)

    return smb_container, exitHandler


class RootDirUtil:
    def __init__(
        self,
        dir_name,
        direct_tcp=False,
        host=None,
        hostname=None,
        my_name='local',
        name_port=137,
        smb_port=None
    ):
        self.host = socket.gethostbyname(socket.gethostname()) if host is None else host
        self.hostname = socket.getfqdn() if hostname is None else hostname

        self.dir_name = dir_name
        self.direct_tcp = direct_tcp
        self.my_name = my_name
        self.name_port = name_port
        self.smb_port = smb_port

        self._container = None
        self._container_exit_handler = None

    def exists(self):
        conn = self.resource()

        return self.dir_name in conn.listShares()

    def create(self):
        """taken care of by smb.conf
        """
        pass

    def _delete(self, path, conn):
        for p in conn.listPath(self.dir_name, path):
            if p.filename != '.' and p.filename != '..':
                subpath = os.path.join(path, p.filename)

                if p.isDirectory:
                    self._delete(subpath, conn)
                    conn.deleteDirectory(self.dir_name, subpath)
                else:
                    conn.deleteFiles(self.dir_name, subpath)

    def delete(self):
        conn = self.resource()

        self._delete('', conn)

    def resource(self):
        kwargs = dict(
            username=smb_user,
            password=smb_passwd,
            my_name=self.my_name,
            remote_name=self.hostname,
            is_direct_tcp=self.direct_tcp,
        )

        conn = SMBConnection(**kwargs)

        # actually connect
        if self.smb_port is not None:
            assert conn.connect(self.host, port=self.smb_port)
        else:
            assert conn.connect(self.host)

        return conn

    def start(self):
        self._container, self._container_exit_handler = startServer(name_port=self.name_port)

    def stop(self):
        if self._container is not None:
            self._container_exit_handler()

        self._container = None
        self._container_exit_handler = None


if __name__ == "__main__":
    smb_container, _ = startServer(name_port=3669)

    def sigHandler(signo, frame):
        sys.exit(0)

    # make sure the atexit-based docker cleanup runs on ctrl-c
    signal.signal(signal.SIGINT, sigHandler)
    signal.signal(signal.SIGTERM, sigHandler)

    old_log = ''
    while True:
        new_log = smb_container.logs()
        if old_log != new_log:
            print(new_log)
            old_log = new_log

        time.sleep(1)
