#!/usr/bin/env bash

# refs:
# https://github.com/docker/for-mac/issues/2359#issuecomment-943131345

open -a /Applications/Docker.app --args --unattended --accept-license
while ! /Applications/Docker.app/Contents/Resources/bin/docker info &>/dev/null; do sleep 1; done

echo "Docker is ready"
