#!/usr/bin/env bash

WORKSPACE_FOLDER="$( cd -P . >/dev/null 2>&1 && pwd )"

# jupyter env vars
export JUPYTER_CONFIG_DIR="${WORKSPACE_FOLDER}/.jupyter"
# export JUPYTER_PATH="${WORKSPACE_FOLDER}/share/jupyter"
# export JUPYTER_RUNTIME_DIR="${JUPYTER_PATH}/runtime"

# jupyterlab env vars
# export JUPYTERLAB_DIR="${WORKSPACE_FOLDER}/share/jupyter/lab"
export JUPYTERLAB_SETTINGS_DIR="${WORKSPACE_FOLDER}/.jupyter/lab"
export JUPYTERLAB_WORKSPACES_DIR="${WORKSPACE_FOLDER}/.jupyter/lab"

# set a custom server settings path
SERVER_SETTINGS="${JUPYTER_CONFIG_DIR}/jupyter_notebook_config.json"

# enable the serverextension and the MetaManager contents manager
mkdir -p $(dirname "$SERVER_SETTINGS")
cat <<EOT > "${SERVER_SETTINGS}"
{
  "ServerApp": {
    "contents_manager_class": "jupyterfs.metamanager.MetaManager",
    "nbserver_extensions": {
      "jupyterfs": true
    }
  }
}
EOT

# set a custom user-settings path
PLUGIN_SETTINGS="${JUPYTERLAB_SETTINGS_DIR}/jupyter-fs/plugin.jupyterlab-settings"

# create appropriate user settings for jupyter-fs
mkdir -p $(dirname $PLUGIN_SETTINGS)
cat <<EOT > "${PLUGIN_SETTINGS}"
{
  "resources": [
    {
      "name": "osfs-here",
      "url": "osfs://${WORKSPACE_FOLDER}"
    }
  ],
  "options": {
    "verbose": true
  },
}
EOT

# print some vars
echo "WORKSPACE_FOLDER: ${WORKSPACE_FOLDER}"
echo "SERVER_SETTINGS: ${SERVER_SETTINGS}"
echo "PLUGIN_SETTINGS: ${PLUGIN_SETTINGS}"

# ensure everything that can goes to stdout
export PYTHONUNBUFFERED="true"

# run the normal jupyterlab browser check
python -m jupyterlab.browser_check --notebook-dir=${WORKSPACE_FOLDER}

# run the jupyterfs-specific browser check
python -m jupyterfs.browser_check --notebook-dir=${WORKSPACE_FOLDER}
