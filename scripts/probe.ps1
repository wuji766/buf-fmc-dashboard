# 探针：附加运行中的表格程序，列出打开的工作簿并测试 XMLSpreadsheet 读取支持
$ErrorActionPreference = 'Stop'
try {
    $app = [System.Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')
} catch {
    Write-Output "Excel.Application attach failed: $($_.Exception.Message)"
    $app = $null
}
if (-not $app) {
    try {
        $app = [System.Runtime.InteropServices.Marshal]::GetActiveObject('ket.Application')
        Write-Output "attached via ket.Application"
    } catch {
        Write-Output "ket.Application attach failed too: $($_.Exception.Message)"
        exit 1
    }
} else {
    Write-Output "attached via Excel.Application"
}
Write-Output "workbook count: $($app.Workbooks.Count)"
foreach ($wb in $app.Workbooks) {
    Write-Output "WB: [$($wb.Name)] full=[$($wb.FullName)] readonly=$($wb.ReadOnly)"
}
$wb2 = $null
foreach ($wb in $app.Workbooks) { if ($wb.Name -like 'BUF*') { $wb2 = $wb } }
if (-not $wb2) { Write-Output "no BUF workbook open"; exit 1 }
foreach ($ws in $wb2.Worksheets) { Write-Output "SHEET: [$($ws.Name)] used=$($ws.UsedRange.Address($false,$false))" }
# 测试 XMLSpreadsheet 参数化读取（只读，不落盘）
try {
    $r = $wb2.Worksheets.Item(1).Range('A1:D6')
    $xml = $r.Value(11)
    Write-Output "XMLSpreadsheet OK, length=$($xml.Length)"
    Write-Output ($xml.Substring(0, [math]::Min(800, $xml.Length)))
} catch {
    Write-Output "XMLSpreadsheet FAILED: $($_.Exception.Message)"
}
