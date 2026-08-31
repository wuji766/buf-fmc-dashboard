# 正式提取：附加运行中的表格程序（用户会话），全程只读
# 产出：每表 SpreadsheetML XML + 行列几何 JSON + 形状 JSON + 参照 PNG（尽力而为）
# 绝不调用 Save/SaveAs，绝不修改用户数据；临时图表对象即建即删
$ErrorActionPreference = 'Stop'
$outDir = 'C:\Users\wuji\ZCodeProject\buf-fmc-dashboard\data'

$app = [System.Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')
$wb = $null
foreach ($b in $app.Workbooks) { if ($b.Name -like 'BUF*') { $wb = $b } }
if (-not $wb) { throw "BUF workbook not open" }

$clipBackup = $null
try { $clipBackup = Get-Clipboard -Raw -ErrorAction SilentlyContinue } catch {}

$sheetFiles = @{ }
$metaList = @()
$idx = 0
foreach ($ws in $wb.Worksheets) {
    $idx++
    $safe = ($ws.Name -replace '[^\w]', '_')
    $ur = $ws.UsedRange
    $r1 = $ur.Row; $c1 = $ur.Column
    $nr = $ur.Rows.Count; $nc = $ur.Columns.Count

    # ---- A1 起整块 XMLSpreadsheet（保留绝对行列索引） ----
    $full = $ws.Range($ws.Cells(1, 1), $ws.Cells($r1 + $nr - 1, $c1 + $nc - 1))
    $xml = $full.Value(11)
    $xmlPath = Join-Path $outDir "sheet-$safe.xml"
    [System.IO.File]::WriteAllText($xmlPath, $xml, (New-Object System.Text.UTF8Encoding $false))
    Write-Output "sheet xml: $xmlPath ($((Get-Item $xmlPath).Length) bytes)"

    # ---- 行列几何（pt） ----
    $colW = New-Object 'System.Collections.Generic.List[double]'
    for ($c = 1; $c -lt $c1 + $nc; $c++) { $colW.Add([math]::Round($ws.Columns($c).Width, 4)) }
    $rowH = New-Object 'System.Collections.Generic.List[double]'
    for ($r = 1; $r -lt $r1 + $nr; $r++) { $rowH.Add([math]::Round($ws.Rows($r).Height, 4)) }
    $geo = [ordered]@{
        name = $ws.Name
        firstRow = $r1; firstCol = $c1; numRows = $nr; numCols = $nc
        standardWidthPt = [math]::Round($ws.StandardWidth, 4)
        standardHeightPt = [math]::Round($ws.StandardHeight, 4)
        colWidthsPt = $colW
        rowHeightsPt = $rowH
    }
    $geoPath = Join-Path $outDir "geom-$safe.json"
    ($geo | ConvertTo-Json -Depth 4) | Out-File $geoPath -Encoding utf8
    Write-Output "geom json: $geoPath"

    # ---- 形状 ----
    $shList = @()
    foreach ($sh in $ws.Shapes) {
        $txt = ''
        try { $txt = $sh.TextFrame2.TextRange.Text } catch { try { $txt = $sh.TextFrame.Characters().Text } catch {} }
        $fillRgb = $null; $lineRgb = $null; $lineW = $null
        try { $fillRgb = $sh.Fill.ForeColor.RGB } catch {}
        try { $lineRgb = $sh.Line.ForeColor.RGB } catch {}
        try { $lineW = $sh.Line.Weight } catch {}
        $autoType = $null; $bArrow = $null; $eArrow = $null
        try { $autoType = $sh.AutoShapeType } catch {}
        try { $bArrow = $sh.Line.BeginArrowheadStyle } catch {}
        try { $eArrow = $sh.Line.EndArrowheadStyle } catch {}
        $shList += [ordered]@{
            name = $sh.Name; shapeType = $sh.Type; autoShapeType = $autoType
            left = [math]::Round($sh.Left, 3); top = [math]::Round($sh.Top, 3)
            width = [math]::Round($sh.Width, 3); height = [math]::Round($sh.Height, 3)
            rotation = $sh.Rotation; text = $txt
            fillRGB = $fillRgb; lineRGB = $lineRgb; lineWeight = $lineW
            topLeftCell = $sh.TopLeftCell.Address($false, $false)
            beginArrow = $bArrow; endArrow = $eArrow
        }
    }
    $metaList += [ordered]@{ sheet = $ws.Name; safeName = $safe; shapes = $shList }

    # ---- 参照 PNG（尽力而为，失败不影响主数据） ----
    try {
        $w = [math]::Ceiling($ur.Width); $h = [math]::Ceiling($ur.Height)
        $ur.CopyPicture(1, -4147)
        $chtObj = $ws.ChartObjects.Add(0, 0, [math]::Min($w, 3200), [math]::Min($h, 4096))
        try {
            $cht = $chtObj.Chart
            $tries = 0
            while ($cht.Shapes.Count -lt 1 -and $tries -lt 15) { $cht.Paste(); $tries++; Start-Sleep -Milliseconds 300 }
            $png = Join-Path $outDir "ref-$safe.png"
            $cht.Export($png)
            Write-Output "ref png: $png"
        } finally {
            try { $chtObj.Delete() } catch {}
        }
    } catch { Write-Output "PNG export skipped for $($ws.Name): $($_.Exception.Message)" }
}

($metaList | ConvertTo-Json -Depth 6) | Out-File (Join-Path $outDir 'shapes.json') -Encoding utf8
Write-Output "shapes.json saved"
try { if ($clipBackup) { Set-Clipboard -Value $clipBackup } } catch {}
Write-Output "DONE"
