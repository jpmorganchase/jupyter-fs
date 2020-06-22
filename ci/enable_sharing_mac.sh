#!/usr/bin/env bash

# possible fix for socket.gethostname() => gaierror: [Errno 8] nodename nor servname provided, or not known
# ref: https://apple.stackexchange.com/q/253817

# enable screen sharing
# ref: https://apple.stackexchange.com/a/89567
sudo launchctl load -w /System/Library/LaunchDaemons/com.apple.screensharing.plist

# enable smb sharing
# ref: https://apple.stackexchange.com/a/136711
sudo launchctl load -w /System/Library/LaunchDaemons/com.apple.smbd.plist
sudo defaults write /Library/Preferences/SystemConfiguration/com.apple.smb.server.plist EnabledServices -array disk

# enable remote login
# ref: https://apple.stackexchange.com/a/302606
sudo launchctl load -w /System/Library/LaunchDaemons/ssh.plist

# enable internet sharing
# ref: https://apple.stackexchange.com/a/2501
sudo launchctl load -w /System/Library/LaunchDaemons/com.apple.InternetSharing.plist
