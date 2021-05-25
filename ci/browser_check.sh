#!/usr/bin/env bash

WORKSPACE_FOLDER=${1:-"$( cd -P . >/dev/null 2>&1 && pwd )"}

export JUPYTER_CONFIG_DIR="${WORKSPACE_FOLDER}/.jupyter"
export JUPYTERLAB_SETTINGS_DIR="${WORKSPACE_FOLDER}/.jupyter/lab"
export JUPYTERLAB_WORKSPACES_DIR="${WORKSPACE_FOLDER}/.jupyter/lab"

# ensure everything that can goes to stdout
export PYTHONUNBUFFERED="true"

# run the normal jupyterlab browser check
python -m jupyterlab.browser_check --notebook-dir=${WORKSPACE_FOLDER}

# run the jupyterfs-specific browser check
python -m jupyterfs.browser_check --notebook-dir=${WORKSPACE_FOLDER}
