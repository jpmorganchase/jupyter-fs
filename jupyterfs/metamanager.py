# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
from hashlib import md5
import json
import re
from tornado import web

from jupyter_server.base.handlers import APIHandler
from jupyter_server.services.contents.manager import ContentsManager

from .auth import substituteAsk, substituteEnv, substituteNone
from .config import Jupyterfs as JupyterfsConfig
from .fsmanager import FSManager
from .pathutils import path_first_arg, path_second_arg, path_kwarg, path_old_new, getDrive, isDrive, stripDrive

__all__ = ["MetaManager", "MetaManagerHandler"]


class MetaManager(ContentsManager):
    copy_pat = re.compile(r'\-Copy\d*\.')

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._jupyterfsConfig = JupyterfsConfig(config=self.config)

        self._kwargs = kwargs
        self._pyfs_kw = {}

        self.resources = []
        self._default_root_manager = self._jupyterfsConfig.root_manager_class(**self._kwargs)
        self._managers = dict((('', self._default_root_manager),))

        # copy kwargs to pyfs_kw, removing kwargs not relevant to pyfs
        self._pyfs_kw.update(kwargs)
        for k in (k for k in ('config', 'log', 'parent') if k in self._pyfs_kw):
            self._pyfs_kw.pop(k)

        self.initResource(*self._jupyterfsConfig.resources)

    def initResource(self, *resources, options={}):
        """initialize one or more (name, url) tuple representing a PyFilesystem resource specification
        """
        # handle options
        cache = 'cache' not in options or options['cache']
        verbose = 'verbose' in options and options['verbose']

        self.resources = []
        managers = dict((('', self._default_root_manager),))

        for resource in resources:
            # server side resources don't have a default 'auth' key
            if 'auth' not in resource:
                resource['auth'] = 'ask'

            # get deterministic hash of PyFilesystem url
            _hash = md5(resource['url'].encode('utf-8')).hexdigest()[:8]
            init = False
            missingTokens = None

            if _hash in self._managers and cache:
                # reuse existing cm
                managers[_hash] = self._managers[_hash]
                init = True
            elif _hash in managers and cache:
                # don't add redundant cm
                init = True
            else:
                if resource['auth'] == 'ask':
                    urlSubbed, missingTokens = substituteAsk(resource)
                elif resource['auth'] == 'env':
                    urlSubbed, missingTokens = substituteEnv(resource)
                else:
                    urlSubbed, missingTokens = substituteNone(resource)

                if missingTokens:
                    # skip trying to init any resource with missing info
                    _hash = '_NOT_INIT'
                    init = False
                else:
                    # create new cm
                    default_writable = resource.get('defaultWritable', True)
                    managers[_hash] = FSManager(
                        urlSubbed,
                        default_writable=default_writable,
                        **self._pyfs_kw
                    )
                    init = True

            # assemble resource from spec + hash
            newResource = {}
            newResource.update(resource)
            newResource.update({
                'drive': _hash,
                'init': init
            })
            if missingTokens is not None:
                newResource['missingTokens'] = missingTokens

            if 'tokenDict' in newResource:
                # sanity check: tokenDict should not make the round trip
                raise ValueError('tokenDict not removed from resource by initResource')

            self.resources.append(newResource)

        # replace existing contents managers with new
        self._managers = managers

        if verbose:
            print('jupyter-fs initialized: {} file system resources, {} managers'.format(len(self.resources), len(self._managers)))

        return self.resources

    @property
    def root_manager(self):
        # in jlab, the root drive prefix is blank
        return self._managers.get('')

    @property
    def root_dir(self):
        return self.root_manager.root_dir

    def copy(self, from_path, to_path=None):
        """Copy an existing file and return its new model.

        If to_path not specified, it will be the parent directory of from_path.
        If to_path is a directory, filename will increment `from_path-Copy#.ext`.
        Considering multi-part extensions, the Copy# part will be placed before the first dot for all the extensions except `ipynb`.
        For easier manual searching in case of notebooks, the Copy# part will be placed before the last dot.

        from_path must be a full path to a file.
        """
        path = from_path.strip('/')
        if to_path is not None:
            to_path = to_path.strip('/')

        if '/' in path:
            from_dir, from_name = path.rsplit('/', 1)
        else:
            from_dir = ''
            from_name = path

        model = self.get(path)
        model.pop('path', None)
        model.pop('name', None)
        if model['type'] == 'directory':
            raise web.HTTPError(400, "Can't copy directories")
        if to_path is None:
            to_path = from_dir
        if self.dir_exists(to_path):
            name = self.copy_pat.sub(u'.', from_name)
            # ensure that any drives are stripped from the resulting filename
            to_name = stripDrive(self.increment_filename(name, to_path, insert='-Copy'))
            # separate path and filename with a slash if to_path is not just a drive string
            to_path = (u'{0}{1}' if isDrive(to_path) else u'{0}/{1}').format(to_path, to_name)

        model = self.save(model, to_path)
        return model

    def _getManagerForPath(self, path):
        drive = getDrive(path)
        mgr = self._managers.get(drive)
        if mgr is None:
            raise web.HTTPError(
                404,
                "Couldn't find manager {mgrName} for {path}".format(mgrName=drive, path=path)
            )

        return mgr, stripDrive(path)

    is_hidden = path_first_arg('is_hidden', False)
    dir_exists = path_first_arg('dir_exists', False)
    file_exists = path_kwarg('file_exists', '', False)
    exists = path_first_arg('exists', False)

    save = path_second_arg('save', 'model', True)
    rename = path_old_new('rename', False)

    get = path_first_arg('get', True)
    delete = path_first_arg('delete', False)

    get_kernel_path = path_first_arg('get_kernel_path', False)

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

class MetaManagerHandler(APIHandler):
    _jupyterfsConfig = None

    @property
    def config_resources(self):
        if self._jupyterfsConfig is None:
            self._jupyterfsConfig = JupyterfsConfig(config=self.config)

        return self._jupyterfsConfig.resources

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
        self.finish(json.dumps(self.contents_manager.resources))

    @web.authenticated
    async def post(self):
        # will be a list of resource dicts
        body = self.get_json_body()
        options = body['options']

        if '_addServerside' in options and options['_addServerside']:
            resources = list((*self.config_resources, *body['resources']))
        else:
            resources = body['resources']

        self.finish(json.dumps(
            self.contents_manager.initResource(*resources, options=options)
        ))
