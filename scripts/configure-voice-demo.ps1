param([string]$Origin = 'https://lemmi.chaoswarrior.dev')
$ErrorActionPreference = 'Stop'
$voiceOrigin = [Uri]$Origin
if ($voiceOrigin.Scheme -ne 'https' -or $voiceOrigin.AbsolutePath -ne '/' -or $voiceOrigin.UserInfo -or $voiceOrigin.Query -or $voiceOrigin.Fragment) { throw 'Use an HTTPS backend origin without a path.' }
$voiceRoot = Split-Path -Parent $PSScriptRoot
$voicePath = Join-Path $voiceRoot '.env.voice.local'
if (Test-Path -LiteralPath $voicePath) { throw 'Private voice configuration already exists. Edit it locally or remove it deliberately before rerunning.' }
$voiceDevice = Read-Host 'Current paired Alex device credential (hidden)' -AsSecureString
$voiceAccess = Read-Host 'Private backend access key (hidden)' -AsSecureString
function Convert-PrivateText([Security.SecureString]$Value) {
  $voicePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($voicePointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($voicePointer) }
}
$voiceTokenText = Convert-PrivateText $voiceDevice
$voiceAccessText = Convert-PrivateText $voiceAccess
try {
  if ($voiceTokenText -notmatch '^[A-Za-z0-9_-]{40,512}$' -or $voiceAccessText -notmatch '^[\x21-\x7e]{32,256}$' -or $voiceAccessText.Contains('"') -or $voiceAccessText.Contains('\')) { throw 'Invalid credential format. No configuration was written.' }
  # This file is ignored by Git. The local server reads it; no browser bundle receives it.
  $voiceEscapedAccess = $voiceAccessText.Replace('$', '\$')
  [IO.File]::WriteAllText($voicePath, "LEMMI_PUBLIC_ORIGIN=$($voiceOrigin.GetLeftPart([UriPartial]::Authority))`nLEMMI_DEVICE_CREDENTIAL=$voiceTokenText`nLEMMI_ACCESS_KEY=`"$voiceEscapedAccess`"`n")
  Write-Host 'Private voice configuration saved. Restart the local web server. No credentials were printed.'
} finally { $voiceTokenText = $null; $voiceAccessText = $null; $voiceDevice.Dispose(); $voiceAccess.Dispose() }
