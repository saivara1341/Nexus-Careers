
Add-Type -AssemblyName System.Drawing

$size = 512
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)

$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 10, 25, 60)) # Navy Blue
$g.FillEllipse($brush, 20, 20, 472, 472)

$font = New-Object System.Drawing.Font("Arial", 200, [System.Drawing.FontStyle]::Bold)
$textBrush = [System.Drawing.Brushes]::Gold
$textSize = $g.MeasureString("N", $font)
$x = ($size - $textSize.Width) / 2
$y = ($size - $textSize.Height) / 2

$g.DrawString("N", $font, $textBrush, $x, $y)

$bmp.Save("nexus_icon_final.png", [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bmp.Dispose()
Write-Host "Created fallback icon."
