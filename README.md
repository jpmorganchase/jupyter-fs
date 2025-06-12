<p align="center">
<a href="https://github.com/jpmorganchase/jupyter-fs/blob/main/docs/img/brand-icon.png?raw=true#gh-light-mode-only">
<img src="https://github.com/jpmorganchase/jupyter-fs/raw/main/docs/img/brand-icon.png?raw=true#gh-light-mode-only" alt="jupyter-fs" width="260">
</a>
<a href="https://github.com/jpmorganchase/jupyter-fs/blob/main/docs/img/brand-icon-white-text.png?raw=true#gh-dark-mode-only">
<img src="https://github.com/jpmorganchase/jupyter-fs/raw/main/docs/img/brand-icon-white-text.png?raw=true#gh-dark-mode-only" alt="jupyter-fs" width="260">
</a>
</p>

#

<p align="center">
<a href="https://github.com/jpmorganchase/jupyter-fs/actions/workflows/build.yml"><img alt="build status" src="https://github.com/jpmorganchase/jupyter-fs/actions/workflows/build.yml/badge.svg?branch=main&event=push"></a>
<a href="https://pypi.python.org/pypi/jupyter-fs"><img alt="pypi package" src="https://img.shields.io/pypi/v/jupyter-fs.svg"></a>
<a href="https://www.npmjs.com/package/jupyter-fs"><img alt="npm package" src="https://img.shields.io/npm/v/jupyter-fs.svg"></a>
<a href="https://mybinder.org/v2/gh/jpmorganchase/jupyter-fs/main?urlpath=lab"><img alt="binder link" src="https://mybinder.org/badge_logo.svg"></a>
</p>

A plugin for JupyterLab that lets you set up and use as many filebrowsers as you like, connected to whatever local and/or remote filesystem-like resources you want.

The backend is built on top of [PyFilesystem](https://github.com/PyFilesystem/pyfilesystem2) and [fsspec](https://filesystem-spec.readthedocs.io/en/latest/), while the frontend is built on top of [tree-finder](https://github.com/tree-finder/tree-finder).


## Install

```bash
pip install jupyter-fs
```


## Configure

Add the following to your `jupyter_server_config.json`:

```json
{
  "ServerApp": {
    "contents_manager_class": "jupyterfs.MetaManager",
    "jpserver_extensions": {
      "jupyterfs.extension": true
    }
  }
}
```

Resources can then be added via the `Settings -> Settings Editor`.

![](https://raw.githubusercontent.com/jpmorganchase/jupyter-fs/main/docs/img/settings.png)


## Simple use (no auth/credentials)

Add specifications for additional contents managers in your user settings (in the **Settings** menu under **Advanced Settings Editor** -> **jupyter-fs**). Here's an example config that sets up several new filebrowsers side-by-side:

```json
{
  "resources": [
    {
      "name": "root at test dir",
      "url": "osfs:///Users/foo/test"
    },
    {
      "name": "s3 test bucket",
      "url": "s3://test"
    },
    {
      "name": "s3 test key",
      "url": "s3://test-2/prefix/",
      "defaultWritable": false
    },
    {
      "name": "samba guest share",
      "url": "smb://guest@127.0.0.1/test?name-port=3669"
    }
  ]
}
```

You should see your new filebrowsers pop up in the left-hand sidebar instantly when you save your settings:

![](https://raw.githubusercontent.com/jpmorganchase/jupyter-fs/main/docs/img/osfs_example.png)


## Use with auth/credentials

Any stretch of a `"url"` that is enclosed in double-brackets `{{VAR}}` will be treated as a template, and will be handled by `jupyter-fs`'s auth system. For example, you can pass a username/password to the `"samba guest share"` resource in the `Simple use` example above by modifying its `"url"` like so:

```json
{
  "resources": [
    ...

    {
      "name": "samba share",
      "url": "smb://{{user}}:{{passwd}}@127.0.0.1/test?name-port=3669"
    }
  ]
}
```

When you save the above `"resouces"` config, a dialog box will pop asking for the `username` and `passwd` values:

![](https://raw.githubusercontent.com/jpmorganchase/jupyter-fs/main/docs/img/remote_example.png)

Once you enter those values and hit ok, the new filebrowsers will then immediately appear in the sidebar:

### The auth dialog will only appear when needed

The `jupyter-fs` auth dialog will only appear when:
- JupyterLab first loads, if any fs resources require auth
- a new fs resouce is added that requires auth, or its `"url"` field is modified


> [!NOTE]
> Additional options are overrideable via environment variables
> by most backends for PyFilesystem and fsspec


## Supported filesystems

The type of resource each filebrowser will point to is determined by the protocol at the start of its url:

### PyFilesystem
- **osfs**: **os** **f**ile**s**ystem. The will open a new view of your local filesystem, with the specified root
- **s3**: opens a filesystem pointing to an Amazon S3 bucket
- **smb**: opens a filesystem pointing to a Samba share

`jupyter-fs` can open a filebrowser pointing to any of the diverse [resources supported by PyFilesystem](https://www.pyfilesystem.org/page/index-of-filesystems/). Currently, we test only test the S3 and smb/samba backends as part of our CI, so your milleage may vary with the other PyFilesystem backends.

### fsspec
- **local** / **file**: Local filesystem
- [**s3fs**](https://s3fs.readthedocs.io/en/latest/): S3 filesystem

`jupyter-fs` should also support any of the [fsspec builtin](https://filesystem-spec.readthedocs.io/en/latest/api.html#built-in-implementations) or [known](https://filesystem-spec.readthedocs.io/en/latest/api.html#other-known-implementations) backends.

In many cases, these will be customized via environment variables. As an example for [s3fs](https://s3fs.readthedocs.io/en/latest/), to customize the backend and auth:

```
export FSSPEC_S3_ENDPOINT_URL=<YOUR BACKEND>
export FSSPEC_S3_KEY=<YOUR KEY>
export FSSPEC_S3_SECRET=<YOUR SECRET>
```

## Choosing the backend

Your resource can include a `"type"` field, set to either `pyfs` or `fsspec`.
The default is `pyfs`.
This field can be configured via JSON Settings or graphically.

![](https://raw.githubusercontent.com/jpmorganchase/jupyter-fs/main/docs/img/settings_choose_backend.png)

## The filesystem url

### PyFilesystem
The `"url"` field `jupyter-fs` config is based on the PyFilesystem [opener url](https://docs.pyfilesystem.org/en/latest/openers.html) standard. For more info on how to write these urls, see the documentation of the relevant PyFilesystem plugin:
- S3: [S3FS docs](https://fs-s3fs.readthedocs.io/en/latest/)
- smb: [fs.smbfs docs](https://github.com/althonos/fs.smbfs#usage)

### fsspec
Similar to PyFilesystem, `fsspec` also allows for a `"url"` based opening scheme as documented [here](https://filesystem-spec.readthedocs.io/en/latest/api.html#fsspec.open).


## Server-side settings

If you prefer to set up your filesystem resources in the server-side config, you can do so. For example, you can set up a local filesystem by adding the following to your `jupyter_server_config.py` file:

```python
c.JupyterFs.resources = [
    {
        "name": "local_test",
        "url": "osfs:///Users/foo/test"
    },
]
```

ALternatively, you can add resource specifications alongside the basic `jupyter-fs` config in your `jupyter_server_config.json` file:

```json
{
  "ServerApp": {
    "contents_manager_class": "jupyterfs.metamanager.MetaManager",
    "jpserver_extensions": {
      "jupyterfs.extension": true
    }
  },
  "JupyterFs": {
    "resources": [
      {
        "name": "local_test",
        "url": "osfs:///Users/foo/test"
      }
    ]
  }
}
```

Any filesystem resources specified in any server-side config file will be merged with the resources given in a user's settings.


## Development

See [CONTRIBUTING.md](https://github.com/jpmorganchase/jupyter-fs/blob/main/.github/CONTRIBUTING.md) for guidelines.


## License

This software is licensed under the Apache 2.0 license. See the
[LICENSE](https://github.com/jpmorganchase/jupyter-fs/blob/main/LICENSE) and [AUTHORS](https://github.com/jpmorganchase/jupyter-fs/blob/main/AUTHORS) files for details.
