<p align="center">
<img alt="jupyter-fs" src="https://raw.githubusercontent.com/telamonian/jupyter-fs/add-auth/docs/brand-icon.svg" width="400">
</p>

#

<p>
<a href="https://dev.azure.com/tpaine154/jupyter/_apis/build/status/jpmorganchase.jupyter-fs?branchName=master"><img alt="azure ci status" src="https://dev.azure.com/tpaine154/jupyter/_apis/build/status/jpmorganchase.jupyter-fs?branchName=master"></a>
<a href="https://ci.appveyor.com/project/telamonian/jupyter-fs/branch/master"><img alt="appveyor ci status (telamonian fork)" src="https://ci.appveyor.com/api/projects/status/d8flhw12vpvgime4/branch/master?svg=true"></a>
<a href="https://pypi.python.org/pypi/jupyter-fs"><img alt="pypi package" src="https://img.shields.io/pypi/v/jupyter-fs.svg"></a>
<a href="https://www.npmjs.com/package/jupyter-fs"><img alt="npm package" src="https://img.shields.io/npm/v/jupyter-fs.svg"></a>
</p>

A plugin for JupyterLab that lets you set up and use as many filebrowsers as you like, connected to whatever local and/or remote filesystem-like resources you want.

The backend is built on top of [PyFilesystem](https://github.com/PyFilesystem/pyfilesystem2), while the frontend is built on top of [JupyterLab Filetree](https://github.com/youngthejames/jupyterlab_filetree).


## Install

```bash
pip install jupyter-fs
```


## Configure

Add the following to your `jupyter_notebook_config.json`:

```json
{
  "NotebookApp": {
    "contents_manager_class": "jupyterfs.metamanager.MetaManager",
    "nbserver_extensions": {
      "jupyterfs": true
    }
  }
}
```


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
      "name": "samba guest share",
      "url": "smb://guest@127.0.0.1/test?name-port=3669"
    }
  ]
}
```

You should see your new filebrowsers pop up in the left-hand sidebar instantly when you save your settings:

![](https://raw.githubusercontent.com/jpmorganchase/jupyter-fs/master/docs/osfs_example.png)


## Use with auth/credentials

Any stretch of a `"url"` that is enclosed in double-brackets `{{VAR}}` will be treated as a template, and will be handled by jupyter-fs's auth system. For example, you can pass a username/password to the `"samba guest share"` resource in the `Simple use` example above by modifying its `"url"` like so:

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

![](https://raw.githubusercontent.com/jpmorganchase/jupyter-fs/master/docs/remote_example.png)

Once you enter those values and hit ok, the new filebrowsers will then immediately appear in the sidebar:


## The auth dialog will only appear when needed

The jupyter-fs auth dialog will only appear when:
- JupyterLab first loads, if any fs resources reqiure auth
- a new fs resouce is added that requires auth, or its `"url"` field is modified


## Supported filesystems

The type of resource each filebrowser will point to is determined by the protocol at the start of its url:

- **osfs**: **os** **f**ile**s**ystem. The will open a new view of your local filesystem, with the specified root
- **s3**: opens a filesystem pointing to an Amazon S3 bucket
- **smb**: opens a filesystem pointing to a Samba share

jupyter-fs can open a filebrowser pointing to any of the diverse [resources supported by PyFilesystem](). Currently, we test only test the S3 and smb/samba backends as part of our CI, so your milleage may vary with the other PyFilesystem backends.


## The filesystem url

The `"url"` field jupyter-fs config is based on the PyFilesystem [opener url](https://docs.pyfilesystem.org/en/latest/openers.html) standard. For more info on how to write these urls, see the documentation of the relevant PyFilesystem plugin:
- S3: [S3FS docs](https://fs-s3fs.readthedocs.io/en/latest/)
- smb: [fs.smbfs docs](https://github.com/althonos/fs.smbfs#usage)


## Server-side settings

If you prefer to set up your filesystem resources in the server-side config, you can do so. For example, you can set up a local filesystem by adding the following to your `jupyter_notebook_config.py` file:

```python
c.jupyterfs.resources = [
    {
        "name": "local_test",
        "url": "osfs:///Users/foo/test"
    },
]
```

ALternatively, you can add resource specifications alongside the basic jupyter-fs config in your `jupyter_notebook_config.json` file:

```json
{
  "NotebookApp": {
    "contents_manager_class": "jupyterfs.metamanager.MetaManager",
    "nbserver_extensions": {
      "jupyterfs.extension": true
    }
  },
  "jupyterfs": {
    "resources": [
      {
        "name": "local_test",
        "url": "osfs:///Users/foo/test"
      },
    ]
  }
}
```

Any filesystem resources specified in any server-side config file will be merged with the resources given in a user's settings.


## Development

See [CONTRIBUTING.md](https://github.com/jpmorganchase/jupyter-fs/blob/master/CONTRIBUTING.md) for guidelines.


## License

This software is licensed under the Apache 2.0 license. See the
[LICENSE](https://github.com/jpmorganchase/jupyter-fs/blob/master/LICENSE) and [AUTHORS](https://github.com/jpmorganchase/jupyter-fs/blob/master/AUTHORS) files for details.
