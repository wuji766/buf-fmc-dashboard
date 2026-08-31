$files = Get-ChildItem 'C:\Users\wuji\ZCodeProject\buf-fmc-dashboard\data\sheet-*.xml', 'C:\Users\wuji\ZCodeProject\buf-fmc-dashboard\data\geom-*.json', 'C:\Users\wuji\ZCodeProject\buf-fmc-dashboard\data\shapes.json'
foreach ($f in $files) {
    $all = [System.IO.File]::ReadAllBytes($f.FullName)
    $hex = ($all[0..3] | ForEach-Object { $_.ToString('X2') }) -join ' '
    $head = [System.Text.Encoding]::UTF8.GetString($all[0..60]) -replace "[\r\n]", ' '
    Write-Output "$($f.Name) | $hex | $($f.Length)b | $head"
}
