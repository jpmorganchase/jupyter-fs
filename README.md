# Jupyter-FS
A filesystem-like `ContentsManager` backend for Jupyter. This library allows you to hook up multiple file backends to Jupyter and interact with their contents using [JupyterLab Filetree](https://github.com/youngthejames/jupyterlab_filetree).


[![Build Status](https://dev.azure.com/tpaine154/jupyter/_apis/build/status/timkpaine.jupyter-fs?branchName=master)](https://dev.azure.com/tpaine154/jupyter/_build/latest?definitionId=20&branchName=master)
[![GitHub issues](https://img.shields.io/github/issues/timkpaine/jupyter-fs.svg)]()
[![Coverage](https://img.shields.io/azure-devops/coverage/tpaine154/jupyter/20)](https://dev.azure.com/tpaine154/jupyter/_build?definitionId=20&_a=summary)
[![PyPI](https://img.shields.io/pypi/l/jupyter-fs.svg)](https://pypi.python.org/pypi/jupyter-fs)
[![PyPI](https://img.shields.io/pypi/v/jupyter-fs.svg)](https://pypi.python.org/pypi/jupyter-fs)
[![npm](https://img.shields.io/npm/v/jupyter-fs.svg)](https://www.npmjs.com/package/jupyter-fs)


## Install

```bash
pip install jupyter-fs
jupyter labextension install jupyter-fs
jupyter serverextension enable --py jupyter-fs
```


## Configure

Add the following to your `jupyter_notebook_config.json`:

```
{
  "NotebookApp": {
    "contents_manager_class": "jupyterfs.meta_contents_manager.MetaContentsManager",
    "nbserver_extensions": {
      "jupyterfs": true
    }
  }
}
```


Register additional contents managers in your `jupyter_notebook_config.py`. As an example, an [S3Contents](https://github.com/danielfrg/s3contents) manager is added as follows:

```
from s3contents import S3ContentsManager
c.JupyterFS.contents_managers = \
{
    's3': S3ContentsManager
}


c.S3ContentsManager.bucket = '<your bucket>'

## SECRET
c.S3ContentsManager.access_key_id = '<your access key>'
c.S3ContentsManager.secret_access_key = '<your secret key>'


```


During application startup, you should see something like this in the logs:
```
JupyterFS active with 2 managers
Installing JupyterFS handler on path /multicontents
```


And in the UI, you will see your contents managers available:
![](https://raw.githubusercontent.com/timkpaine/jupyter-fs/master/docs/example.gif)


We can add additional contents managers:

```
c.MultiContentsManager.contents_managers = \
{
    's3': S3ContentsManager,
    'file2': AbsolutePathFileManager(root_dir=os.path.expanduser("~/Downloads"))
}
```

Here I utilize an `AbsolutePathFileManager` to grab another folder on my system for use. Remember, remote filesystems are still remote, and locally you may need to move around the filesystem with a `os.chdir` command (or equivalent in other languages).

Here, I have the above `s3` and `AbsolutePathFileManager`, along with the original contents manager, for a total of 3 seperate spaces. 

![](https://raw.githubusercontent.com/timkpaine/jupyter-fs/master/docs/example2.gif)


## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.


## License

This software is licensed under the Apache 2.0 license. See the
[LICENSE](LICENSE) and [AUTHORS](AUTHORS) files for details.