param([string]$SourceFile = "nexus_icon_final.png")

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $SourceFile)) {
    Write-Host "Error: Source file '$SourceFile' not found."
    exit 1
}

$startImage = [System.Drawing.Image]::FromFile($SourceFile)

function Resize-Image {
    param($img, $w, $h, $path)
    $canvas = New-Object System.Drawing.Bitmap $w, $h
    $graph = [System.Drawing.Graphics]::FromImage($canvas)
    $graph.CompositingQuality = "HighQuality"
    $graph.InterpolationMode = "HighQualityBicubic"
    $graph.SmoothingMode = "HighQuality"
    
    $graph.DrawImage($img, 0, 0, $w, $h)
    
    $folder = Split-Path $path
    if (-not (Test-Path $folder)) { mkdir $folder | Out-Null }
    
    $canvas.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $graph.Dispose()
    $canvas.Dispose()
    Write-Host "Saved: $path"
}

$resDir = "android\app\src\main\res"

# Legacy Icon Sizes
$legacySizes = @{
    "mipmap-mdpi"    = 48
    "mipmap-hdpi"    = 72
    "mipmap-xhdpi"   = 96
    "mipmap-xxhdpi"  = 144
    "mipmap-xxxhdpi" = 192
}

# Adaptive Foreground Sizes (108/48 * legacy_size roughly 2.25x)
$adaptiveSizes = @{
    "mipmap-mdpi"    = 108
    "mipmap-hdpi"    = 162
    "mipmap-xhdpi"   = 216
    "mipmap-xxhdpi"  = 324
    "mipmap-xxxhdpi" = 432
}

Write-Host "Updating Legacy Icons..."
foreach ($key in $legacySizes.Keys) {
    $size = $legacySizes[$key]
    Resize-Image $startImage $size $size "$resDir\$key\ic_launcher.png"
    Resize-Image $startImage $size $size "$resDir\$key\ic_launcher_round.png"
}

Write-Host "Updating Adaptive Foreground Icons..."
foreach ($key in $adaptiveSizes.Keys) {
    $size = $adaptiveSizes[$key]
    Resize-Image $startImage $size $size "$resDir\$key\ic_launcher_foreground.png"
}

$startImage.Dispose()
Write-Host "Done."
