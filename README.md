# Multi ContentsManager
A meta `ContentsManager` for installing multiple backends using [JupyterLab Filetree](https://github.com/youngthejames/jupyterlab_filetree)


[![Build Status](https://travis-ci.org/timkpaine/multicontentsmanager.svg?branch=master)](https://travis-ci.org/timkpaine/multicontentsmanager)
[![GitHub issues](https://img.shields.io/github/issues/timkpaine/multicontentsmanager.svg)]()
[![codecov](https://codecov.io/gh/timkpaine/multicontentsmanager/branch/master/graph/badge.svg)](https://codecov.io/gh/timkpaine/multicontentsmanager)
[![PyPI](https://img.shields.io/pypi/l/multicontentsmanager.svg)](https://pypi.python.org/pypi/multicontentsmanager)
[![PyPI](https://img.shields.io/pypi/v/multicontentsmanager.svg)](https://pypi.python.org/pypi/multicontentsmanager)
[![npm](https://img.shields.io/npm/v/multicontentsmanager.svg)](https://www.npmjs.com/package/multicontentsmanager)


## Install

```bash
pip install multicontentsmanager
jupyter labextension install multicontentsmanager
jupyter serverextension enable --py multicontentsmanager
```


## Configure

Add the following to your `jupyter_notebook_config.json`:

```
{
  "NotebookApp": {
    "contents_manager_class": "multicontentsmanager.metacontentsmanager.MetaContentsManager",
    "nbserver_extensions": {
      "multicontentsmanager": true
    }
  }
}
```


Register additional contents managers in your `jupyter_notebook_config.py`. As an example, an [S3Contents](https://github.com/danielfrg/s3contents) manager is added as follows:

```
from s3contents import S3ContentsManager
c.MultiContentsManager.contents_managers = \
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
MultiContentsManager active with 2 managers
Installing multicontentsmanager handler on path /multicontents
```


And in the UI, you will see your contents manager available:

