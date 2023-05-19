#!/usr/bin/env bash

# possible fix for socket.gethostname() => gaierror: [Errno 8] nodename nor servname provided, or not known
# ref: https://stackoverflow.com/q/39970606

sudo echo "127.0.0.1 computer_name" >> /etc/hosts
