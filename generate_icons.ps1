Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Antigravity\belajar\octoleven_logo"
$baseDir = "C:\Antigravity\belajar\android\app\src\main\res"

$src = [System.Drawing.Image]::FromFile($srcPath)
Write-Host "Source image size: $($src.Width)x$($src.Height)"

function Resize-And-Save {
    param(
        [System.Drawing.Image]$Image,
        [int]$Width,
        [int]$Height,
        [string]$DestPath,
        [bool]$IsRound = $false,
        [bool]$IsAdaptiveForeground = $false
    )
    
    $destBitmap = New-Object System.Drawing.Bitmap $Width, $Height
    $graphics = [System.Drawing.Graphics]::FromImage($destBitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    if ($IsAdaptiveForeground) {
        # Adaptive icon foreground has 108dp canvas where icon content should be centered in ~72dp (approx 66-72% of canvas)
        $contentSize = [int]($Width * 0.72)
        $offsetX = [int](($Width - $contentSize) / 2)
        $offsetY = [int](($Height - $contentSize) / 2)
        
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.DrawImage($Image, $offsetX, $offsetY, $contentSize, $contentSize)
    } elseif ($IsRound) {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddEllipse(0, 0, $Width, $Height)
        $graphics.SetClip($path)
        $graphics.DrawImage($Image, 0, 0, $Width, $Height)
        $path.Dispose()
    } else {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.DrawImage($Image, 0, 0, $Width, $Height)
    }

    $graphics.Dispose()

    $destDir = [System.IO.Path]::GetDirectoryName($DestPath)
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }

    $destBitmap.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBitmap.Dispose()
    Write-Host "Saved: $DestPath ($Width x $Height)"
}

function Generate-Splash {
    param(
        [System.Drawing.Image]$Image,
        [int]$Width,
        [int]$Height,
        [string]$DestPath
    )

    $destBitmap = New-Object System.Drawing.Bitmap $Width, $Height
    $graphics = [System.Drawing.Graphics]::FromImage($destBitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    # Background color matching theme (#fff8f7)
    $bgColor = [System.Drawing.ColorTranslator]::FromHtml("#fff8f7")
    $graphics.Clear($bgColor)

    # Center the logo with appropriate padding (logo takes ~35% of the shortest dimension)
    $minDim = [Math]::Min($Width, $Height)
    $logoSize = [int]($minDim * 0.40)
    $offsetX = [int](($Width - $logoSize) / 2)
    $offsetY = [int](($Height - $logoSize) / 2)

    $graphics.DrawImage($Image, $offsetX, $offsetY, $logoSize, $logoSize)
    $graphics.Dispose()

    $destDir = [System.IO.Path]::GetDirectoryName($DestPath)
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }

    $destBitmap.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBitmap.Dispose()
    Write-Host "Saved Splash: $DestPath ($Width x $Height)"
}

# Android mipmap densities & sizes
$densities = @(
    @{ folder = "mipmap-mdpi"; size = 48; fgSize = 108 },
    @{ folder = "mipmap-hdpi"; size = 72; fgSize = 162 },
    @{ folder = "mipmap-xhdpi"; size = 96; fgSize = 216 },
    @{ folder = "mipmap-xxhdpi"; size = 144; fgSize = 324 },
    @{ folder = "mipmap-xxxhdpi"; size = 192; fgSize = 432 }
)

foreach ($d in $densities) {
    $folder = Join-Path $baseDir $d.folder
    
    # Standard square/squircle launcher icon
    $iconPath = Join-Path $folder "ic_launcher.png"
    Resize-And-Save -Image $src -Width $d.size -Height $d.size -DestPath $iconPath
    
    # Round launcher icon
    $roundIconPath = Join-Path $folder "ic_launcher_round.png"
    Resize-And-Save -Image $src -Width $d.size -Height $d.size -DestPath $roundIconPath -IsRound $true
    
    # Adaptive launcher foreground
    $fgPath = Join-Path $folder "ic_launcher_foreground.png"
    Resize-And-Save -Image $src -Width $d.fgSize -Height $d.fgSize -DestPath $fgPath -IsAdaptiveForeground $true
}

# Android Splash screens
$splashes = @(
    @{ path = "drawable\splash.png"; w = 480; h = 320 },
    @{ path = "drawable-land-mdpi\splash.png"; w = 480; h = 320 },
    @{ path = "drawable-land-hdpi\splash.png"; w = 800; h = 480 },
    @{ path = "drawable-land-xhdpi\splash.png"; w = 1280; h = 720 },
    @{ path = "drawable-land-xxhdpi\splash.png"; w = 1600; h = 960 },
    @{ path = "drawable-land-xxxhdpi\splash.png"; w = 1920; h = 1280 },
    @{ path = "drawable-port-mdpi\splash.png"; w = 320; h = 480 },
    @{ path = "drawable-port-hdpi\splash.png"; w = 480; h = 800 },
    @{ path = "drawable-port-xhdpi\splash.png"; w = 720; h = 1280 },
    @{ path = "drawable-port-xxhdpi\splash.png"; w = 960; h = 1600 },
    @{ path = "drawable-port-xxxhdpi\splash.png"; w = 1280; h = 1920 }
)

foreach ($s in $splashes) {
    $fullSplashPath = Join-Path $baseDir $s.path
    Generate-Splash -Image $src -Width $s.w -Height $s.h -DestPath $fullSplashPath
}

# Also generate Web/PWA icons in www and root
$webIcons = @(
    @{ path = "C:\Antigravity\belajar\icon-192.png"; size = 192 },
    @{ path = "C:\Antigravity\belajar\icon-512.png"; size = 512 },
    @{ path = "C:\Antigravity\belajar\www\icon-192.png"; size = 192 },
    @{ path = "C:\Antigravity\belajar\www\icon-512.png"; size = 512 },
    @{ path = "C:\Antigravity\belajar\favicon.png"; size = 64 },
    @{ path = "C:\Antigravity\belajar\www\favicon.png"; size = 64 }
)

foreach ($w in $webIcons) {
    Resize-And-Save -Image $src -Width $w.size -Height $w.size -DestPath $w.path
}

$src.Dispose()
Write-Host "All icons & splash screens generated successfully!"
