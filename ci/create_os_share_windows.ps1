#Requires -RunAsAdministrator

$ErrorActionPreference = 'Stop'

$smbuser_passwd = ConvertTo-SecureString "smbuser" -AsPlainText -Force
New-LocalUser "smbuser" -Password $smbuser_passwd

mkdir C:\shared

New-SmbShare -Name "test" -Path "C:\shared" -FullAccess smbuser

# display info on newly-created share
Get-SmbShare
