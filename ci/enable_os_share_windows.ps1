#Requires -RunAsAdministrator

$ErrorActionPreference = 'Stop'

# script to overcome all weird windows vm settings on azure

# disable all password requirements (length, complexity, etc)
# needed to allow for creation of new account smbuser:smbuser
secedit /export /cfg c:\secpol.cfg
(gc C:\secpol.cfg).replace("PasswordComplexity = 1", "PasswordComplexity = 0") | Out-File C:\secpol.cfg
secedit /configure /db c:\windows\security\local.sdb /cfg c:\secpol.cfg /areas SECURITYPOLICY
rm -force c:\secpol.cfg -confirm:$false

# turn on file sharing
netsh advfirewall firewall set rule group="File and Printer Sharing" new enable=Yes

# print out some info about local NETBIOS cache
nbtstat -c

# print out some info about local NETBIOS names
nbtstat -n

# print out some info about local NETBIOS resolutions
nbtstat -r
