#!/usr/bin/env bash

# refs:
# https://github.com/docker/for-mac/issues/2359#issuecomment-943131345

brew install --cask docker
sudo /Applications/Docker.app/Contents/MacOS/Docker --unattended --install-privileged-components
