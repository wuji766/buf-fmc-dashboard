# 参照 PNG 导出（WPS ChartObjects 参数化属性兼容写法）
$ErrorActionPreference = 'Stop'
$outDir = 'C:\Users\wuji\ZCodeProject\buf-fmc-dashboard\data'
$app = [System.Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')
$wb = $null
foreach ($b in $app.Workbooks) { if ($b.Name -like 'BUF*') { $wb = $b } }
if (-not $wb) { throw "BUF workbook not open" }

$clipBackup = $null
try { $clipBackup = Get-Clipboard -Raw -ErrorAction SilentlyContinue } catch {}

foreach ($ws in $wb.Worksheets) {
    $safe = ($ws.Name -replace '[^\w]', '_')
    try {
        $ur = $ws.UsedRange
        $w = [math]::Ceiling($ur.Width); $h = [math]::Ceiling($ur.Height)
        $ur.CopyPicture(1, -4147)
        $chtObj = $null
        try {
            $cos = $ws.ChartObjects()
            $chtObj = $cos.Add(0, 0, [math]::Min($w, 3200), [math]::Min($h, 4096))
        } catch {
            Write-Output "ChartObjects() failed: $($_.Exception.Message); try AddChart2"
            $shp = $ws.Shapes.AddChart2(0, 1)   # xlColumnClustered 占位，仅当画布用
            $chtObj = $shp.Chart.Parent
        }
        try {
            $cht = $chtObj.Chart
            $tries = 0
            while ($cht.Shapes.Count -lt 1 -and $tries -lt 15) { $cht.Paste(); $tries++; Start-Sleep -Milliseconds 300 }
            $png = Join-Path $outDir "ref-$safe.png"
            $cht.Export($png)
            Write-Output "ref png: $png ($((Get-Item $png).Length) bytes)"
        } finally {
            try { $chtObj.Delete() } catch { try { $chtObj.Parent.Delete() } catch {} }
        }
    } catch { Write-Output "PNG export failed for $($ws.Name): $($_.Exception.Message)" }
}
try { if ($clipBackup) { Set-Clipboard -Value $clipBackup } } catch {}
Write-Output "DONE"
