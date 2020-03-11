# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
from notebook.services.contents.manager import ContentsManager
from notebook.services.contents.largefilemanager import LargeFileManager
from .pathutils import path_first_arg, path_second_arg, path_kwarg, path_old_new


class MetaContentsManager(ContentsManager):
    def __init__(self, **kwargs):
        self._contents_managers = {'': LargeFileManager(**kwargs)}
        self._kwargs = kwargs
        self._inited = False

    def init(self, managers=None):
        if self._inited:
            return
        self._inited = True
        self._contents_managers.update({_[0]: _[1](**self._kwargs) if isinstance(_[1], type) else _[1] for _ in (managers or {}).items()})

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
