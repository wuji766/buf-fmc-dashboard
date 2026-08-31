# BUF FMC xlsx 只读提取脚本
# 独立隐藏 Excel 实例 ReadOnly 打开，导出 SpreadsheetML XML + 形状 JSON + 每表参照 PNG
# 绝不保存原文件；所有输出写入项目 data 目录
$ErrorActionPreference = 'Stop'
$src   = 'C:\Users\wuji\Downloads\BUF FMC数据维护.xlsx'
$outDir = 'C:\Users\wuji\ZCodeProject\buf-fmc-dashboard\data'

if (-not (Test-Path $src)) { throw "source not found: $src" }

# 备份剪贴板文本（CopyPicture 会占用剪贴板）
$clipBackup = $null
try { $clipBackup = Get-Clipboard -Raw -ErrorAction SilentlyContinue } catch {}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
    $wb = $excel.Workbooks.Open($src, 0, $true)   # UpdateLinks=0, ReadOnly=true

    # ---- 1) 完整 SpreadsheetML 2003 XML（含样式/合并/边框/字体/方向） ----
    $xmlPath = Join-Path $outDir 'buf-fmc.xml'
    $wb.SaveAs($xmlPath, 46)   # 46 = xlXMLSpreadsheet
    Write-Output "XML saved: $xmlPath ($((Get-Item $xmlPath).Length) bytes)"

    # ---- 2) 工作表元信息 + 形状清单 ----
    $sheets = @()
    foreach ($ws in $wb.Worksheets) {
        $shList = @()
        foreach ($sh in $ws.Shapes) {
            $txt = ''
            try { $txt = $sh.TextFrame2.TextRange.Text } catch {}
            $fillRgb = $null; $lineRgb = $null; $lineW = $null
            try { $fillRgb = $sh.Fill.ForeColor.RGB } catch {}
            try { $lineRgb = $sh.Line.ForeColor.RGB } catch {}
            try { $lineW = $sh.Line.Weight } catch {}
            $autoType = $null; $beginArrow = $null; $endArrow = $null
            try { $autoType = $sh.AutoShapeType } catch {}
            try { $beginArrow = $sh.Line.BeginArrowheadStyle } catch {}
            try { $endArrow = $sh.Line.EndArrowheadStyle } catch {}
            $shList += [ordered]@{
                name = $sh.Name
                shapeType = $sh.Type
                autoShapeType = $autoType
                left = [math]::Round($sh.Left, 3)
                top = [math]::Round($sh.Top, 3)
                width = [math]::Round($sh.Width, 3)
                height = [math]::Round($sh.Height, 3)
                rotation = $sh.Rotation
                text = $txt
                fillRGB = $fillRgb
                lineRGB = $lineRgb
                lineWeight = $lineW
                topLeftCell = $sh.TopLeftCell.Address($false, $false)
                beginArrow = $beginArrow
                endArrow = $endArrow
            }
        }
        $sheets += [ordered]@{
            name = $ws.Name
            usedRange = $ws.UsedRange.Address($false, $false)
            standardWidthPt = [math]::Round($ws.StandardWidth, 4)
            standardHeightPt = [math]::Round($ws.StandardHeight, 4)
            shapes = $shList
        }
    }
    $sheets | ConvertTo-Json -Depth 6 | Out-File (Join-Path $outDir 'sheets-meta.json') -Encoding utf8
    Write-Output "sheets-meta.json saved"

    # ---- 3) 每表 UsedRange 参照 PNG（CopyPicture -> 临时图表导出） ----
    foreach ($ws in $wb.Worksheets) {
        $ur = $ws.UsedRange
        $w = [math]::Ceiling($ur.Width); $h = [math]::Ceiling($ur.Height)
        $ur.CopyPicture(1, -4147)   # xlScreen, xlPicture
        $chtObj = $ws.ChartObjects.Add(0, 0, [math]::Min($w, 3200), [math]::Min($h, 4096))
        $cht = $chtObj.Chart
        $tries = 0
        while ($cht.Shapes.Count -lt 1 -and $tries -lt 10) { $cht.Paste(); $tries++; Start-Sleep -Milliseconds 300 }
        $safeName = $ws.Name -replace '[^\w\-]', '_'
        $png = Join-Path $outDir ("ref-$safeName.png")
        $cht.Export($png)
        $chtObj.Delete()
        Write-Output "PNG saved: $png"
    }
} finally {
    $excel.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
}
# 恢复剪贴板
try { if ($clipBackup) { Set-Clipboard -Value $clipBackup } } catch {}
Write-Output "DONE"
