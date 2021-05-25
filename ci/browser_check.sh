#!/usr/bin/env bash
set -e

## func for getting the real pth to a script
## (regardless of aliases). Takes $BASH_SOURCE as first arg, eg:
##
##   SOURCE=$(thispath $BASH_SOURCE)
##
## ref: https://stackoverflow.com/a/246128/425458
thispath()
{
    SOURCE_LIST=$1
    SOURCE="${SOURCE_LIST[0]}"
    while [ -h "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink
        DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"
        SOURCE="$(readlink "$SOURCE")"
        [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE" # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
    done

    _THIS_DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"
    _THIS_NAME="$(basename "$SOURCE")"
    echo "$(ls -d "$_THIS_DIR"/"$_THIS_NAME")"
}

## func for getting the real pth to a script's
## dir (regardless of aliases). Takes $BASH_SOURCE as first arg, eg:
##
##   HERE=$(thisdir $BASH_SOURCE)
##
thisdir()
{
    SOURCE="$(thispath "$1")"
    echo "$( cd -P "$( dirname "$SOURCE" )" >/dev/null 2>&1 && pwd )"
}

# path to the dir containing this script
HERE="$(thisdir $BASH_SOURCE)"

# set up environment and config files for jupyter.
# The config root dir is stored in JUPYTER_CONFIG_DIR
source "$HERE/generate_jupyter_config.sh" "$@"

# ensure everything that can goes to stdout
export PYTHONUNBUFFERED="true"

# run the normal jupyterlab browser check. Rerun once if it fails
python -m jupyterlab.browser_check || python -m jupyterlab.browser_check

# run the jupyterfs-specific browser check. Rerun once if it fails
python -m jupyterfs.browser_check || python -m jupyterfs.browser_check

# clean up all of the jupyter config files that were created for this check
# rm -rf $JUPYTER_CONFIG_DIR
