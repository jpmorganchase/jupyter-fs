# *****************************************************************************
#
# Copyright (c) 2019, the jupyter-fs authors.
#
# This file is part of the jupyter-fs library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#
import smb
from fs.smbfs import SMBFS
from fs.permissions import Permissions
from ._version import __version__  # noqa: F401
from .extension import load_jupyter_server_extension  # noqa: F401


def _jupyter_server_extension_paths():
    return [{
        "module": "jupyterfs.extension"
    }]


# monkey patch that applies diff from PR:
# https://github.com/althonos/fs.smbfs/pull/11

@classmethod
def _make_access_from_sd(cls, sd):
    """Translate a `SecurityDescriptor` object to a raw access `dict`.
    Arguments:
        sd (smb.security_descriptors.SecurityDescriptor): the security
            descriptors obtained through SMB.
    Note:
        Since Windows (and as such, SMB) do not handle the permissions the
        way UNIX does, the permissions here are translated as such:
            * ``user`` mode is taken from the *read* / *write* / *execute*
                access descriptors of the user owning the resource.
            * ``group`` mode is taken from the *read* / *write* / *execute*
                access descriptors of the group owning the resource.
            * ``other`` mode uses the permissions of the **Everyone** group,
                which means sometimes an user could be denied access to a
                file Windows technically allows to open (since there is no
                such thing as *other* groups in Windows).
    """
    access = {'gid': str(sd.group), 'uid': str(sd.owner)}

    # Extract Access Control Entries corresponding to
    # * `everyone` (used for UNIX `others` mode)
    # * `owner` (used for UNIX `user` mode, falls back to `everyone`)
    # * `group` (used for UNIX `group` mode, falls back to `everyone`)
    other_ace = next((ace for ace in sd.dacl.aces
                      if str(ace.sid).startswith(smb.security_descriptors.SID_EVERYONE)), None)
    owner_ace = next((ace for ace in sd.dacl.aces
                      if str(ace.sid).startswith(str(sd.owner))), other_ace)
    group_ace = next((ace for ace in sd.dacl.aces
                      if str(ace.sid).startswith(str(sd.group))), other_ace)

    # Defines the masks used to check for the attributes
    attributes = {
        'r': smb.smb_constants.FILE_READ_DATA
        & smb.smb_constants.FILE_READ_ATTRIBUTES,
        'w': smb.smb_constants.FILE_WRITE_DATA
        & smb.smb_constants.FILE_WRITE_ATTRIBUTES,
        'x': smb.smb_constants.FILE_EXECUTE,
    }

    # Defines the mask used for each mode
    other_mask = other_ace.mask if other_ace is not None else 0x0
    modes = {
        'u': (owner_ace.mask if owner_ace is not None else 0x0) | other_mask,
        'g': (group_ace.mask if group_ace is not None else 0x0) | other_mask,
        'o': other_mask,
    }

    # Create the permissions from a permission list
    access['permissions'] = Permissions([
        '{}_{}'.format(mode_name, attr_name)
        for mode_name, mode_mask in modes.items()
        for attr_name, attr_mask in attributes.items()
        if attr_mask & mode_mask
    ])

    return access


SMBFS._make_access_from_sd = _make_access_from_sd
