#!/usr/bin/env bash

# ref: https://apple.stackexchange.com/a/136711
sudo launchctl load -w com.apple.smbd.plist
sudo defaults write /Library/Preferences/SystemConfiguration/com.apple.smb.server.plist EnabledServices -array disk
