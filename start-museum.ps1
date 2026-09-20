Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
Write-Output 'Open http://127.0.0.1:8768 in your browser. Press Ctrl+C here to stop the local museum.'
py -3.11 -m http.server 8768 --bind 127.0.0.1 --directory web
