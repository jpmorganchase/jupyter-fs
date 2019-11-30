from tornado.web import HTTPError
from notebook.services.contents.manager import ContentsManager
from notebook.services.contents.largefilemanager import LargeFileManager

# A reference implementation
# https://github.com/quantopian/pgcontents/blob/master/pgcontents/hybridmanager.py
# Apache 2.0
# https://github.com/quantopian/pgcontents/blob/2ddca481532a4e983b4370dae8ca7f11da5e5c30/LICENSE


def _resolve_path(path, manager_dict):
    """
    Resolve a path based on a dictionary of manager prefixes.

    Returns a triple of (prefix, manager, manager_relative_path).
    """
    parts = path.strip('/').split(":")
    if len(parts) == 1:
        parts.append("")

    # Try to find a sub-manager for the first subdirectory.
    mgr = manager_dict.get(parts[0])
    if mgr is not None:
        return parts[0], mgr, '/'.join(parts[1:])

    # Try to find use the root manager, if one was supplied.
    mgr = manager_dict.get('')
    if mgr is not None:
        return '', mgr, path

    raise HTTPError(
        404,
        "Couldn't resolve path [{path}] and "
        "no root manager supplied!".format(path=path)
    )


def _get_arg(argname, args, kwargs):
    """
    Get an argument, either from kwargs or from the first entry in args.
    Raises a TypeError if argname not in kwargs and len(args) == 0.

    Mutates kwargs in place if the value is found in kwargs.
    """
    try:
        return kwargs.pop(argname), args
    except KeyError:
        pass
    try:
        return args[0], args[1:]
    except IndexError:
        raise TypeError("No value passed for %s" % argname)


# Dispatch decorators.
def path_dispatch1(mname, returns_model):
    """
    Decorator for methods that accept path as a first argument.
    """

    def _wrapper(self, *args, **kwargs):
        path, args = _get_arg('path', args, kwargs)
        prefix, mgr, mgr_path = _resolve_path(path, self._contents_managers)
        result = getattr(mgr, mname)(mgr_path, *args, **kwargs)
        return result

    return _wrapper


def path_dispatch2(mname, first_argname, returns_model):
    """
    Decorator for methods that accept path as a second argument.
    """

    def _wrapper(self, *args, **kwargs):
        other, args = _get_arg(first_argname, args, kwargs)
        path, args = _get_arg('path', args, kwargs)
        prefix, mgr, mgr_path = _resolve_path(path, self._contents_managers)
        result = getattr(mgr, mname)(other, mgr_path, *args, **kwargs)
        return result
    return _wrapper


def path_dispatch_kwarg(mname, path_default, returns_model):
    """
    Parameterized decorator for methods that accept path as a second
    argument.
    """

    def _wrapper(self, path=path_default, **kwargs):
        prefix, mgr, mgr_path = _resolve_path(path, self._contents_managers)
        result = getattr(mgr, mname)(path=mgr_path, **kwargs)
        return result
    return _wrapper


def path_dispatch_old_new(mname, returns_model):
    """
    Decorator for methods accepting old_path and new_path.
    """

    def _wrapper(self, old_path, new_path, *args, **kwargs):
        old_prefix, old_mgr, old_mgr_path = _resolve_path(
            old_path, self._contents_managers
        )
        new_prefix, new_mgr, new_mgr_path = _resolve_path(
            new_path, self._contents_managers,
        )
        if old_mgr is not new_mgr:
            # TODO: Consider supporting this via get+delete+save.
            raise HTTPError(
                400,
                "Can't move files between backends ({old} -> {new})".format(
                    old=old_path,
                    new=new_path,
                )
            )
        assert new_prefix == old_prefix
        result = getattr(new_mgr, mname)(
            old_mgr_path,
            new_mgr_path,
            *args,
            **kwargs
        )
        return result
    return _wrapper


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

    is_hidden = path_dispatch1('is_hidden', False)
    dir_exists = path_dispatch1('dir_exists', False)
    file_exists = path_dispatch_kwarg('file_exists', '', False)
    exists = path_dispatch1('exists', False)

    save = path_dispatch2('save', 'model', True)
    rename = path_dispatch_old_new('rename', False)

    get = path_dispatch1('get', True)
    delete = path_dispatch1('delete', False)

    create_checkpoint = path_dispatch1('create_checkpoint', False)
    list_checkpoints = path_dispatch1('list_checkpoints', False)
    restore_checkpoint = path_dispatch2(
        'restore_checkpoint',
        'checkpoint_id',
        False,
    )
    delete_checkpoint = path_dispatch2(
        'delete_checkpoint',
        'checkpoint_id',
        False,
    )
