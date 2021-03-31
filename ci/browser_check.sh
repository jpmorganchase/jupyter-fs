#!/usr/bin/env bash

WORKSPACE_FOLDER="$( cd -P . >/dev/null 2>&1 && pwd )"

# ensure everything that can goes to stdout
export PYTHONUNBUFFERED="true"

# run the normal jupyterlab browser check
python -m jupyterlab.browser_check --notebook-dir=${WORKSPACE_FOLDER}

# run the jupyterfs-specific browser check
python -m jupyterfs.browser_check --notebook-dir=${WORKSPACE_FOLDER}
