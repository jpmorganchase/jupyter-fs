# jupyter-fs
A plugin for JupyterLab that lets you set up and use as many filebrowsers as you like, connected to whatever local and/or remote filesystem-like resources you want.

The backend is built on top of [PyFilesystem](https://github.com/PyFilesystem/pyfilesystem2), while the frontend is built on top of [JupyterLab Filetree](https://github.com/youngthejames/jupyterlab_filetree).


[![Build Status](https://dev.azure.com/tpaine154/jupyter/_apis/build/status/jpmorganchase.jupyter-fs?branchName=master)](https://dev.azure.com/tpaine154/jupyter/_build/latest?definitionId=23&branchName=master)
[![GitHub issues](https://img.shields.io/github/issues/timkpaine/jupyter-fs.svg)]()
[![Coverage](https://img.shields.io/azure-devops/coverage/tpaine154/jupyter/23/master)](https://dev.azure.com/tpaine154/jupyter/_build?definitionId=23&_a=summary)
[![PyPI](https://img.shields.io/pypi/l/jupyter-fs.svg)](https://pypi.python.org/pypi/jupyter-fs)
[![PyPI](https://img.shields.io/pypi/v/jupyter-fs.svg)](https://pypi.python.org/pypi/jupyter-fs)
[![npm](https://img.shields.io/npm/v/jupyter-fs.svg)](https://www.npmjs.com/package/jupyter-fs)


## Install

```bash
pip install jupyter-fs
```


## Configure

Add the following to your `jupyter_notebook_config.json`:

```
{
  "NotebookApp": {
    "contents_manager_class": "jupyterfs.metamanager.MetaManager",
    "nbserver_extensions": {
      "jupyterfs": true
    }
  }
}
```

## Use

Add specifications for additional contents managers in your user settings (in the **Settings** menu under **Advanced Settings Editor** -> **jupyter-fs**). Here's an example of how to set up two new views of the local filesystem:

```json
{
  "specs": [
    {
      "name": "local_test",
      "url": "osfs:///Users/foo/test"
    },
    {
      "name": "local_jupyter-fs_repo",
      "url": "osfs:///Users/foo/git/jupyter-fs"
    }
  ]
}
```

where **osfs** stands for **os** **f**ile**s**ystem. You should see your new filebrowser pop up in the left-hand sidebar instantly when you save your settings:

![](./docs/osfs_example.png)

## PyFilesystem urls

`"url"` is a [PyFilesystem opener url](https://docs.pyfilesystem.org/en/latest/openers.html). For more info on how to write these urls, see the documentation of the relevant PyFilesystem plugin:
- S3: [S3FS docs](https://fs-s3fs.readthedocs.io/en/latest/)
- smb: [fs.smbfs docs](https://github.com/althonos/fs.smbfs#usage)

## (EXPERIMENTAL) Adding remote filesystems

**Not recommended for production use: currently requires saving your credentials in plaintext**

jupyter-fs also supports a wide variety of remote filesystem-like resources. Currently, only S3 and smb/samba are confirmed to work/part of the test suite. In theory, any resource supported by PyFilesystem should be supported by jupyter-fs as well.

You can set up all of these different resources side-by-side:

```json
{
  "specs": [
    {
      "name": "osfs_jupyter-fs_repo",
      "url": "osfs:///Users/foo/git/jupyter-fs"
    },
    {
      "name": "s3_foo",
      "url": "s3://username:passwd@foo?endpoint_url=http://127.0.0.1:9000"
    },
    {
      "name": "smb_test",
      "url": "smb://username:passwd@127.0.0.1/test?name-port=3669"
    }
  ]
}
```

![](./docs/remote_example.png)

## Server-side settings

If you prefer to set up your filesystem resources in the server-side config, you can do so. For example, you can set up a local filesystem by adding the following to your `jupyter_notebook_config.py`:

```python
c.jupyterfs.specs = [
    {
        "name": "local_test",
        "url": "osfs:///Users/foo/test"
    },
]
```

Any filesystem specs given in the server-side config will be merged with the specs given in a user's settings.

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.


## License

This software is licensed under the Apache 2.0 license. See the
[LICENSE](LICENSE) and [AUTHORS](AUTHORS) files for details.
