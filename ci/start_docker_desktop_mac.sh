#!/usr/bin/env bash

# refs:
# https://stackoverflow.com/a/35979292/425458
# https://crossprogramming.com/2019/12/27/use-docker-when-running-integration-tests-with-azure-pipelines.html#self-managed-docker-containers

[[ $(uname) == 'Darwin' ]] || { echo "This function only runs on macOS." >&2; exit 2; }

printf "Starting Docker.app, if necessary"

# Wait for the server to start up, if applicable.
retries=0
while ! docker system info &>/dev/null; do
    if (( retries % 30 == 0 )); then
        if pgrep -xq -- "Docker"; then
            printf '\nDocker init still running'
        else
            (( retries != 0 )) && printf '\nDocker not running, restart'
            open -g -a Docker.app || exit
        fi

        if [[ ${retries} -gt 600 ]]; then
            printf '\nFailed to run Docker'
            exit 1
        fi
    fi

    printf '.'
    (( retries++))
    sleep 1
done
(( retries )) && printf '\n'

echo "Docker is ready"
