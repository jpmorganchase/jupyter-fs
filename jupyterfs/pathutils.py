# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
from tornado.web import HTTPError

# A reference implementation
# https://github.com/quantopian/pgcontents/blob/master/pgcontents/hybridmanager.py
# Apache 2.0
# https://github.com/quantopian/pgcontents/blob/2ddca481532a4e983b4370dae8ca7f11da5e5c30/LICENSE
#
# This reference implementation allows you to mount multiple contents managers
# under the same / path (e.g. in the same frontend contents manager component).
# Here, we want the ability to distinguish between multiple contents managers
# via the use of an arbitrary URI prefix e.g. file:, so we make some extensive
# modifications to support this.


def _resolve_path(path, manager_dict):
    """Resolve a path based on a dictionary of manager prefixes.

    Args:
        path (str): the path being requested
        manager_dict (dict): dictionary of available contents managers
    Returns:
        tuple: prefix of contents manager, instance of contents manager, relative path to request from contents manager
    """
    parts = path.strip('/').split(":")
    if len(parts) == 1:
        # Try to find use the root manager, if one was supplied.
        mgr = manager_dict.get('')
        if mgr is not None:
            return '', mgr, path

        raise HTTPError(
            404,
            "Couldn't resolve path [{path}] and "
            "no root manager supplied!".format(path=path)
        )
    else:
        # Try to find a sub-manager for the first subdirectory.
        mgr = manager_dict.get(parts[0])
        if mgr is not None:
            return parts[0], mgr, '/'.join(parts[1:])

        raise HTTPError(
            404,
            "Couldn't resolve path [{path}]".format(path=path)
        )


def _get_arg(argname, args, kwargs):
    """Get an argument, either from kwargs or from the first entry in args.
    Raises a TypeError if argname not in kwargs and len(args) == 0.
    Mutates kwargs in place if the value is found in kwargs.

    Args:
        argname (str): argument name to get
        args (tuple): args to look in
        kwargs (dict): kwargs to look in
    Returns:
        argument, remaining args
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
def path_first_arg(method_name, returns_model):
    """Decorator for methods that accept path as a first argument,
    e.g. manager.get(path, ...)"""

    def _wrapper(self, *args, **kwargs):
        path, args = _get_arg('path', args, kwargs)
        _, mgr, mgr_path = _resolve_path(path, self._managers)
        result = getattr(mgr, method_name)(mgr_path, *args, **kwargs)
        return result

    return _wrapper


def path_second_arg(method_name, first_argname, returns_model):
    """Decorator for methods that accept path as a second argument.
    e.g. manager.save(model, path, ...)"""

    def _wrapper(self, *args, **kwargs):
        other, args = _get_arg(first_argname, args, kwargs)
        path, args = _get_arg('path', args, kwargs)
        _, mgr, mgr_path = _resolve_path(path, self._managers)
        result = getattr(mgr, method_name)(other, mgr_path, *args, **kwargs)
        return result
    return _wrapper


def path_kwarg(method_name, path_default, returns_model):
    """Parameterized decorator for methods that accept path as a second
    argument.

    e.g. manager.file_exists(path='')
    """

    def _wrapper(self, path=path_default, **kwargs):
        _, mgr, mgr_path = _resolve_path(path, self._managers)
        result = getattr(mgr, method_name)(path=mgr_path, **kwargs)
        return result
    return _wrapper


def path_old_new(method_name, returns_model):
    """Decorator for methods accepting old_path and new_path.

    e.g. manager.rename(old_path, new_path)
    """

    def _wrapper(self, old_path, new_path, *args, **kwargs):
        old_prefix, old_mgr, old_mgr_path = _resolve_path(
            old_path, self._managers
        )
        new_prefix, new_mgr, new_mgr_path = _resolve_path(
            new_path, self._managers,
        )
        if old_mgr is not new_mgr:
            # TODO: Consider supporting this via get+delete+save.
            raise HTTPError(
                400,
                "Can't move files between backends yet ({old} -> {new})".format(
                    old=old_path,
                    new=new_path,
                )
            )
        assert new_prefix == old_prefix
        result = getattr(new_mgr, method_name)(
            old_mgr_path,
            new_mgr_path,
            *args,
            **kwargs
        )
        return result
    return _wrapper
