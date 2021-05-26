#!/usr/bin/env bash

## the current working directory
WORKSPACE_FOLDER=${1:-"$( cd -P . >/dev/null 2>&1 && pwd )"}

## jupyter env vars
# export JUPYTER_PREFER_ENV_PATH="true"
export JUPYTER_CONFIG_DIR="${WORKSPACE_FOLDER}/.jupyter"
# export JUPYTER_PATH="${WORKSPACE_FOLDER}/share/jupyter"
# export JUPYTER_RUNTIME_DIR="${JUPYTER_PATH}/runtime"

## jupyterlab env vars
# export JUPYTERLAB_DIR="${WORKSPACE_FOLDER}/share/jupyter/lab"
export JUPYTERLAB_SETTINGS_DIR="${WORKSPACE_FOLDER}/.jupyter/lab"
export JUPYTERLAB_WORKSPACES_DIR="${WORKSPACE_FOLDER}/.jupyter/lab"

## clean the target config dir
rm -rf "$JUPYTER_CONFIG_DIR"
mkdir -p "$JUPYTER_CONFIG_DIR"

# ## NotebookApp: enable the serverextension and the MetaManager contents manager
# NOTEBOOKAPP_SETTINGS="${JUPYTER_CONFIG_DIR}/jupyter_notebook_config.json"
#
# mkdir -p $(dirname "$NOTEBOOKAPP_SETTINGS")
# cat <<EOT > "${NOTEBOOK_SETNOTEBOOKAPP_SETTINGSTINGS}"
# {
#   "NotebookApp": {
#     "contents_manager_class": "jupyterfs.metamanager.MetaManager",
#     "nbserver_extensions": {
#       "jupyterfs.extension": true
#     }
#   }
# }
# EOT


# SERVERAPP_SETTINGS_D="${JUPYTER_CONFIG_DIR}/jupyter_server_config.d/browser_check.json"
# mkdir -p $(dirname "$SERVERAPP_SETTINGS_D")
# cat <<EOT > "${SERVERAPP_SETTINGS_D}"
# {
#   "ServerApp": {
#     "jpserver_extensions": {
#       "jupyterfs.extension": true,
#       "jupyterlab.browser_check": true
#     }
#   }
# }
# EOT

## ServerApp: enable the serverextension and the MetaManager contents manager
SERVERAPP_SETTINGS_JSON="${JUPYTER_CONFIG_DIR}/jupyter_server_config.json"
mkdir -p $(dirname "$SERVERAPP_SETTINGS_JSON")
cat <<EOT > "${SERVERAPP_SETTINGS_JSON}"
{
  "ServerApp": {
    "contents_manager_class": "jupyterfs.metamanager.MetaManager"
  }
}
EOT

## set a custom user-settings path
PLUGIN_SETTINGS="${JUPYTERLAB_SETTINGS_DIR}/jupyter-fs/plugin.jupyterlab-settings"

## create appropriate user settings for jupyter-fs
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

## print some vars
echo "WORKSPACE_FOLDER: ${WORKSPACE_FOLDER}"
echo "SERVERAPP_SETTINGS_D: ${SERVERAPP_SETTINGS_D}"
echo "SERVERAPP_SETTINGS_JSON: ${SERVERAPP_SETTINGS_JSON}"
echo "PLUGIN_SETTINGS: ${PLUGIN_SETTINGS}"
