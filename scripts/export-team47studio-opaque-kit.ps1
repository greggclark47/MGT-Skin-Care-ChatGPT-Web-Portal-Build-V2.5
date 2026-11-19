param(
  [string]$OutputRoot = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$transparentRoot = Join-Path $projectRoot "work\brand\Team47Studio-Transparent-Logo-Kit-2026-11-05-v2"
if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = Join-Path $projectRoot "work\brand\Team47Studio-Opaque-Production-Kit-2026-11-05"
}

$mark = Join-Path $transparentRoot "masters\team47studio-mark-master-transparent.png"
$stackLight = Join-Path $transparentRoot "masters\team47studio-stacked-light-surface-master-transparent.png"
$stackDark = Join-Path $transparentRoot "masters\team47studio-stacked-dark-surface-master-transparent.png"
$horizontalLight = Join-Path $transparentRoot "masters\team47studio-horizontal-light-surface-master-transparent.png"
$horizontalDark = Join-Path $transparentRoot "masters\team47studio-horizontal-dark-surface-master-transparent.png"

foreach ($path in @($mark, $stackLight, $stackDark, $horizontalLight, $horizontalDark)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing transparent master: $path" }
}

Add-Type -AssemblyName System.Drawing

$typeSource = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class Team47OpaqueKit {
    static void Configure(Graphics g) {
        g.CompositingMode = CompositingMode.SourceOver;
        g.CompositingQuality = CompositingQuality.HighQuality;
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        g.SmoothingMode = SmoothingMode.HighQuality;
    }

    static void PaintBackground(Graphics g, Rectangle rect, bool dark) {
        Color start = dark ? Color.FromArgb(9, 13, 24) : Color.FromArgb(255, 255, 255);
        Color end = dark ? Color.FromArgb(40, 20, 82) : Color.FromArgb(234, 244, 255);
        using (LinearGradientBrush brush = new LinearGradientBrush(rect, start, end, 35f)) {
            g.FillRectangle(brush, rect);
        }
        if (dark) {
            using (SolidBrush cyan = new SolidBrush(Color.FromArgb(28, 0, 188, 216)))
                g.FillEllipse(cyan, -rect.Width / 7, -rect.Height / 4, rect.Width * 2 / 3, rect.Height * 2 / 3);
            using (SolidBrush violet = new SolidBrush(Color.FromArgb(24, 126, 49, 218)))
                g.FillEllipse(violet, rect.Width * 2 / 3, rect.Height / 2, rect.Width / 2, rect.Height / 2);
        }
    }

    static void DrawContained(Graphics g, Bitmap source, Rectangle bounds, double occupancy) {
        int maxW = Math.Max(1, (int)Math.Round(bounds.Width * occupancy));
        int maxH = Math.Max(1, (int)Math.Round(bounds.Height * occupancy));
        double scale = Math.Min((double)maxW / source.Width, (double)maxH / source.Height);
        int w = Math.Max(1, (int)Math.Round(source.Width * scale));
        int h = Math.Max(1, (int)Math.Round(source.Height * scale));
        int x = bounds.X + (bounds.Width - w) / 2;
        int y = bounds.Y + (bounds.Height - h) / 2;
        g.DrawImage(source, new Rectangle(x, y, w, h));
    }

    public static void Render(string sourcePath, string outputPath, int width, int height, bool dark, double occupancy, bool rgba) {
        PixelFormat pixelFormat = rgba ? PixelFormat.Format32bppArgb : PixelFormat.Format24bppRgb;
        using (Bitmap source = new Bitmap(sourcePath))
        using (Bitmap output = new Bitmap(width, height, pixelFormat)) {
            output.SetResolution(96, 96);
            using (Graphics g = Graphics.FromImage(output)) {
                Configure(g);
                PaintBackground(g, new Rectangle(0, 0, width, height), dark);
                DrawContained(g, source, new Rectangle(0, 0, width, height), occupancy);
            }
            output.Save(outputPath, ImageFormat.Png);
        }
    }

    public static void ResizeOpaque(string sourcePath, string outputPath, int size, bool rgba) {
        PixelFormat pixelFormat = rgba ? PixelFormat.Format32bppArgb : PixelFormat.Format24bppRgb;
        using (Bitmap source = new Bitmap(sourcePath))
        using (Bitmap output = new Bitmap(size, size, pixelFormat)) {
            output.SetResolution(96, 96);
            using (Graphics g = Graphics.FromImage(output)) {
                Configure(g);
                g.Clear(Color.FromArgb(255, 9, 13, 24));
                g.DrawImage(source, new Rectangle(0, 0, size, size));
            }
            output.Save(outputPath, ImageFormat.Png);
        }
    }

    public static bool HasTransparentPixels(string path) {
        using (Bitmap bitmap = new Bitmap(path)) {
            if ((bitmap.PixelFormat & PixelFormat.Alpha) == 0 && (bitmap.PixelFormat & PixelFormat.PAlpha) == 0) return false;
            for (int y = 0; y < bitmap.Height; y++)
                for (int x = 0; x < bitmap.Width; x++)
                    if (bitmap.GetPixel(x, y).A < 255) return true;
            return false;
        }
    }
}
'@

if (-not ("Team47OpaqueKit" -as [type])) {
  $runtimeDir = Split-Path -Parent ([System.Drawing.Bitmap].Assembly.Location)
  $refs = @(
    [System.Drawing.Bitmap].Assembly.Location,
    [System.Drawing.Color].Assembly.Location,
    [System.Collections.Generic.Queue[int]].Assembly.Location,
    (Join-Path $runtimeDir "System.Runtime.dll"),
    (Join-Path $runtimeDir "System.Collections.dll"),
    (Join-Path $runtimeDir "System.Private.Windows.GdiPlus.dll"),
    (Join-Path $runtimeDir "System.Private.Windows.Core.dll")
  ) | Select-Object -Unique
  Add-Type -TypeDefinition $typeSource -ReferencedAssemblies $refs
}

$folders = @(
  "marketing\stacked", "marketing\horizontal", "marketing\social", "marketing\presentation",
  "web-icons", "google-play", "android\legacy", "ios\AppIcon.appiconset",
  "ios\legacy-sizes", "documentation"
)
foreach ($folder in $folders) { New-Item -ItemType Directory -Path (Join-Path $OutputRoot $folder) -Force | Out-Null }

foreach ($variant in @(
  @{ Key = "dark"; Stack = $stackDark; Horizontal = $horizontalDark; Dark = $true },
  @{ Key = "light"; Stack = $stackLight; Horizontal = $horizontalLight; Dark = $false }
)) {
  foreach ($size in @(
    @{ W = 1600; H = 1200 }, @{ W = 1200; H = 900 }, @{ W = 800; H = 600 }
  )) {
    $out = Join-Path $OutputRoot "marketing\stacked\team47studio-stacked-$($variant.Key)-background-$($size.W)x$($size.H)-opaque.png"
    [Team47OpaqueKit]::Render($variant.Stack, $out, $size.W, $size.H, $variant.Dark, 0.84, $false)
  }
  foreach ($size in @(
    @{ W = 2400; H = 600 }, @{ W = 1600; H = 400 }, @{ W = 1200; H = 300 }, @{ W = 800; H = 200 }
  )) {
    $out = Join-Path $OutputRoot "marketing\horizontal\team47studio-horizontal-$($variant.Key)-background-$($size.W)x$($size.H)-opaque.png"
    [Team47OpaqueKit]::Render($variant.Horizontal, $out, $size.W, $size.H, $variant.Dark, 0.88, $false)
  }
  [Team47OpaqueKit]::Render($variant.Stack, (Join-Path $OutputRoot "marketing\social\team47studio-social-square-$($variant.Key)-background-1080x1080-opaque.png"), 1080, 1080, $variant.Dark, 0.82, $false)
  [Team47OpaqueKit]::Render($mark, (Join-Path $OutputRoot "marketing\social\team47studio-profile-mark-$($variant.Key)-background-1080x1080-opaque.png"), 1080, 1080, $variant.Dark, 0.72, $false)
  [Team47OpaqueKit]::Render($variant.Horizontal, (Join-Path $OutputRoot "marketing\presentation\team47studio-presentation-$($variant.Key)-background-1920x1080-opaque.png"), 1920, 1080, $variant.Dark, 0.72, $false)
  [Team47OpaqueKit]::Render($variant.Horizontal, (Join-Path $OutputRoot "marketing\horizontal\team47studio-email-header-$($variant.Key)-background-1200x300-opaque.png"), 1200, 300, $variant.Dark, 0.86, $false)
}

foreach ($variant in @(
  @{ Key = "dark"; Dark = $true }, @{ Key = "light"; Dark = $false }
)) {
  foreach ($size in @(512, 192, 180, 64, 48, 32, 16)) {
    [Team47OpaqueKit]::Render($mark, (Join-Path $OutputRoot "web-icons\team47studio-web-icon-$($variant.Key)-background-${size}x${size}-opaque.png"), $size, $size, $variant.Dark, 0.76, $false)
  }
}

$playSource = Join-Path $OutputRoot "google-play\team47studio-google-play-icon-source-1024x1024-opaque-rgba.png"
[Team47OpaqueKit]::Render($mark, $playSource, 1024, 1024, $true, 0.74, $true)
[Team47OpaqueKit]::ResizeOpaque($playSource, (Join-Path $OutputRoot "google-play\team47studio-google-play-app-icon-512x512-opaque-rgba.png"), 512, $true)
[Team47OpaqueKit]::Render($horizontalDark, (Join-Path $OutputRoot "google-play\team47studio-google-play-feature-graphic-1024x500-opaque-rgb.png"), 1024, 500, $true, 0.72, $false)

foreach ($size in @(48, 72, 96, 144, 192, 512)) {
  [Team47OpaqueKit]::ResizeOpaque($playSource, (Join-Path $OutputRoot "android\legacy\team47studio-android-launcher-${size}x${size}-opaque.png"), $size, $false)
}

$iosBase = Join-Path $OutputRoot "ios\AppIcon.appiconset\AppIcon-1024.png"
[Team47OpaqueKit]::Render($mark, $iosBase, 1024, 1024, $true, 0.74, $false)
foreach ($size in @(180, 167, 152, 120, 87, 80, 76, 60, 58, 40)) {
  [Team47OpaqueKit]::ResizeOpaque($iosBase, (Join-Path $OutputRoot "ios\legacy-sizes\team47studio-ios-appicon-${size}x${size}-opaque.png"), $size, $false)
}

$contents = @'
{
  "images" : [
    {
      "filename" : "AppIcon-1024.png",
      "idiom" : "universal",
      "platform" : "ios",
      "size" : "1024x1024"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
'@
[System.IO.File]::WriteAllText((Join-Path $OutputRoot "ios\AppIcon.appiconset\Contents.json"), $contents, [System.Text.UTF8Encoding]::new($false))

$readme = @"
# Team47Studio Opaque Production Logo Kit

Created: November 5, 2026

All PNG files in this kit render with fully opaque backgrounds. No file contains a transparent pixel.

## Store assets

- Google Play app icon: 512 x 512, full square, RGBA PNG with every alpha value set to 255, under the 1024 KB limit.
- Google Play feature graphic: 1024 x 500, RGB PNG with no alpha.
- iOS AppIcon: 1024 x 1024, RGB PNG with no alpha and square corners. Apple applies the platform mask.
- Android legacy launcher sizes: 48, 72, 96, 144, 192, and 512 pixels.
- iOS convenience sizes: 40, 58, 60, 76, 80, 87, 120, 152, 167, and 180 pixels.

## Marketing assets

Dark-background assets use the white Team wordmark. Light-background assets use the dark Team wordmark. Marketing exports include stacked, horizontal, social-square, profile-mark, presentation, and email-header layouts.

## Official references

- Google Play icon specifications: https://developer.android.com/distribute/google-play/resources/icon-design-specifications
- Google Play preview asset requirements: https://support.google.com/googleplay/android-developer/answer/9866151
- Apple app icon guidance: https://developer.apple.com/design/human-interface-guidelines/app-icons
- Xcode app icon configuration: https://developer.apple.com/documentation/xcode/configuring-your-app-icon

Do not add rounded corners or store-generated shadows to the source icons; Apple and Google apply their own masks and presentation treatments.
"@
[System.IO.File]::WriteAllText((Join-Path $OutputRoot "documentation\README.md"), $readme, [System.Text.UTF8Encoding]::new($false))

$rows = foreach ($file in Get-ChildItem -LiteralPath $OutputRoot -Recurse -File | Where-Object { $_.Extension -eq ".png" }) {
  $bitmap = [System.Drawing.Bitmap]::new($file.FullName)
  try {
    [PSCustomObject]@{
      File = $file.FullName.Substring($OutputRoot.Length + 1)
      Width = $bitmap.Width
      Height = $bitmap.Height
      PixelFormat = $bitmap.PixelFormat.ToString()
      HasTransparentPixels = [Team47OpaqueKit]::HasTransparentPixels($file.FullName)
      Bytes = $file.Length
      SHA256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
    }
  } finally { $bitmap.Dispose() }
}
$rows | Sort-Object File | Export-Csv -LiteralPath (Join-Path $OutputRoot "documentation\manifest.csv") -NoTypeInformation -Encoding UTF8

$playIcon = Join-Path $OutputRoot "google-play\team47studio-google-play-app-icon-512x512-opaque-rgba.png"
if ((Get-Item -LiteralPath $playIcon).Length -gt 1MB) { throw "Google Play app icon exceeds the 1024 KB limit." }
if (@($rows | Where-Object { $_.HasTransparentPixels -eq $true }).Count -gt 0) { throw "One or more opaque exports still contain transparent pixels." }

$zipPath = "$OutputRoot.zip"
Compress-Archive -Path (Join-Path $OutputRoot "*") -DestinationPath $zipPath -Force

[PSCustomObject]@{
  OutputRoot = $OutputRoot
  ZipPath = $zipPath
  PngCount = @($rows).Count
  AllOpaque = (@($rows | Where-Object { $_.HasTransparentPixels -eq $true }).Count -eq 0)
  GooglePlayIconBytes = (Get-Item -LiteralPath $playIcon).Length
  ZipBytes = (Get-Item -LiteralPath $zipPath).Length
  ZipSHA256 = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash
}
