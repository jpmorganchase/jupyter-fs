# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
from hashlib import md5
import json
from tornado import web

from notebook.base.handlers import IPythonHandler
from notebook.services.contents.largefilemanager import LargeFileManager
from notebook.services.contents.manager import ContentsManager

from .meta_contents_manager import PyFilesystemContentsManager
from .pathutils import path_first_arg, path_second_arg, path_kwarg, path_old_new

__all__ = ["MetaContentsHandler", "MetaContentsManager"]


class MetaContentsManager(ContentsManager):
    def __init__(self, **kwargs):
        self.info = []

        self._default_cm = ('', LargeFileManager(**kwargs))

        self._contents_managers = dict([self._default_cm])
        self._kwargs = kwargs

    # def init(self, managers=None):
    #     """initialize dict of (key, manager OR manager class)
    #     """
    #     if managers:
    #         self._contents_managers.update({k: man(**self._kwargs) if isinstance(man, type) else man for k,man in managers.items()})

    def initResource(self, *resource):
        """initialize one or more triples representing a PyFilesystem resource
        """
        self.info = []
        managers = dict([self._default_cm])

        for r in resource:
            # get deterministic hash of PyFilesystem url
            _hash = md5(r['fsurl'].encode('utf-8')).hexdigest()

            if _hash in self._contents_managers:
                # reuse existing cm
                managers[_hash] = self._contents_managers[_hash]
            elif _hash in managers:
                # don't add redundant cm
                pass
            else:
                # create new cm
                managers[_hash] = PyFilesystemContentsManager.open_fs(r['fsurl'])

            # add resource to info
            i = {'drive': _hash}
            i.update(r)
            self.info.append(i)

        # replace existing contents managers with new
        self._contents_managers = managers

        return self.info

    @property
    def root_manager(self):
        return self._contents_managers.get('')

    is_hidden = path_first_arg('is_hidden', False)
    dir_exists = path_first_arg('dir_exists', False)
    file_exists = path_kwarg('file_exists', '', False)
    exists = path_first_arg('exists', False)

    save = path_second_arg('save', 'model', True)
    rename = path_old_new('rename', False)

    get = path_first_arg('get', True)
    delete = path_first_arg('delete', False)

    create_checkpoint = path_first_arg('create_checkpoint', False)
    list_checkpoints = path_first_arg('list_checkpoints', False)
    restore_checkpoint = path_second_arg(
        'restore_checkpoint',
        'checkpoint_id',
        False,
    )
    delete_checkpoint = path_second_arg(
        'delete_checkpoint',
        'checkpoint_id',
        False,
    )

class MetaContentsHandler(IPythonHandler):
    @property
    def config_resources(self):
        return self.config.get('jupyterfs', {}).get('resources', [])

    @web.authenticated
    async def get(self):
        """Returns all the available contents manager prefixes

        e.g. if the contents manager configuration is something like:
        {
            "file": LargeFileContentsManager,
            "s3": S3ContentsManager,
            "samba": SambaContentsManager
        }

        the result here will be:
        ["file", "s3", "samba"]

        which will allow the frontent to instantiate 3 new filetrees, one
        for each of the available contents managers.
        """
        self.finish(json.dumps(self.contents_manager.info))

    @web.authenticated
    async def post(self):
        data = self.get_json_body()

        self.finish(json.dumps({
            "info": self.contents_manager.initResource(*self.config_resources, *data["resources"])
        }))
