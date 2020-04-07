#Requires -RunAsAdministrator

# discover true names of errors:
# $Error[0].Exception.GetType().FullName

$ErrorActionPreference = 'Stop'

try {
    Get-SmbShare -name "test"
    Remove-SmbShare -name "test" -force
}
catch [Microsoft.PowerShell.Cmdletization.Cim.CimJobException] {
}

try {
    ls C:\shared
    rm -r -fo C:\shared
}
catch [System.Management.Automation.ItemNotFoundException] {
}

try {
    Get-LocalUser -name "smbuser"
    Remove-LocalUser -name "smbuser"
}
catch [Microsoft.PowerShell.Commands.UserNotFoundException] {
}
