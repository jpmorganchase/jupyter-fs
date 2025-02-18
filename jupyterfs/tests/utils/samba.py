#!/usr/bin/env python
# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.

import os
import socket

from smb.SMBConnection import SMBConnection

__all__ = ["smb_user", "smb_passwd", "RootDirUtil"]

smb_user = "smbuser"
smb_passwd = "smbuser"

_dir = os.path.dirname(os.path.abspath(os.path.realpath(__file__)))


class RootDirUtil:
    def __init__(
        self,
        dir_name,
        direct_tcp=False,
        host=None,
        hostname=None,
        my_name="local",
        name_port=137,
        smb_port=None,
    ):
        self.host = socket.gethostbyname(socket.gethostname()) if host is None else host
        self.hostname = socket.gethostname() if hostname is None else hostname

        self.dir_name = dir_name
        self.direct_tcp = direct_tcp
        self.my_name = my_name
        self.name_port = name_port
        self.smb_port = smb_port

    def exists(self):
        conn = self.resource()

        return self.dir_name in conn.listShares()

    def create(self):
        pass

    def _delete(self, path, conn):
        for p in conn.listPath(self.dir_name, path):
            if p.filename != "." and p.filename != "..":
                subpath = os.path.join(path, p.filename)

                if p.isDirectory:
                    self._delete(subpath, conn)
                    conn.deleteDirectory(self.dir_name, subpath)
                else:
                    conn.deleteFiles(self.dir_name, subpath)

    def delete(self):
        conn = self.resource()

        self._delete("", conn)

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
