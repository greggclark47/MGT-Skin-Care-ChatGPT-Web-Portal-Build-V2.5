param(
  [string]$OutputRoot = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = Join-Path $projectRoot "work\brand\Team47Studio-Transparent-Logo-Kit-2026-11-05-v2"
}

$lightSource = "C:\Users\gmad4\OneDrive\Desktop\Team47Studio-Standalone-Logo-Variation-07.png"
$darkSource = "C:\Users\gmad4\OneDrive\Desktop\Team47Studio-Dark-Logo-07-Standalone.png"

foreach ($path in @($lightSource, $darkSource)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Missing source logo: $path"
  }
}

Add-Type -AssemblyName System.Drawing

$typeSource = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class Team47LogoKit {
    static bool IsConnectedBackgroundCandidate(Color c) {
        int max = Math.Max(c.R, Math.Max(c.G, c.B));
        int min = Math.Min(c.R, Math.Min(c.G, c.B));
        return min >= 198 && (max - min) <= 28;
    }

    static Rectangle AlphaBounds(Bitmap bmp, byte threshold) {
        int minX = bmp.Width, minY = bmp.Height, maxX = -1, maxY = -1;
        for (int y = 0; y < bmp.Height; y++) {
            for (int x = 0; x < bmp.Width; x++) {
                if (bmp.GetPixel(x, y).A <= threshold) continue;
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
        return maxX < minX ? new Rectangle(0, 0, 1, 1) : Rectangle.FromLTRB(minX, minY, maxX + 1, maxY + 1);
    }

    static Bitmap CropAlpha(Bitmap source, int padding) {
        Rectangle b = AlphaBounds(source, 3);
        int left = Math.Max(0, b.Left - padding);
        int top = Math.Max(0, b.Top - padding);
        int right = Math.Min(source.Width, b.Right + padding);
        int bottom = Math.Min(source.Height, b.Bottom + padding);
        Rectangle r = Rectangle.FromLTRB(left, top, right, bottom);
        Bitmap output = new Bitmap(r.Width, r.Height, PixelFormat.Format32bppArgb);
        output.SetResolution(source.HorizontalResolution, source.VerticalResolution);
        using (Graphics g = Graphics.FromImage(output)) {
            g.CompositingMode = CompositingMode.SourceCopy;
            g.DrawImage(source, new Rectangle(0, 0, r.Width, r.Height), r, GraphicsUnit.Pixel);
        }
        return output;
    }

    public static void ExtractConnectedBackground(string inputPath, string outputPath, bool preserveWhiteWord) {
        using (Bitmap source = new Bitmap(inputPath)) {
            int w = source.Width, h = source.Height;
            bool[] background = new bool[w * h];
            int[] queue = new int[w * h];
            int queueHead = 0, queueTail = 0;

            for (int x = 0; x < w; x++) {
                int top = x;
                if (!background[top] && IsConnectedBackgroundCandidate(source.GetPixel(x, 0))) { background[top] = true; queue[queueTail++] = top; }
                int bottom = (h - 1) * w + x;
                if (!background[bottom] && IsConnectedBackgroundCandidate(source.GetPixel(x, h - 1))) { background[bottom] = true; queue[queueTail++] = bottom; }
            }
            for (int y = 1; y < h - 1; y++) {
                int left = y * w;
                if (!background[left] && IsConnectedBackgroundCandidate(source.GetPixel(0, y))) { background[left] = true; queue[queueTail++] = left; }
                int right = y * w + (w - 1);
                if (!background[right] && IsConnectedBackgroundCandidate(source.GetPixel(w - 1, y))) { background[right] = true; queue[queueTail++] = right; }
            }

            int[] dx = new int[] { -1, 1, 0, 0 };
            int[] dy = new int[] { 0, 0, -1, 1 };
            while (queueHead < queueTail) {
                int idx = queue[queueHead++];
                int x = idx % w, y = idx / w;
                for (int n = 0; n < 4; n++) {
                    int nx = x + dx[n], ny = y + dy[n];
                    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                    int ni = ny * w + nx;
                    if (background[ni]) continue;
                    if (!IsConnectedBackgroundCandidate(source.GetPixel(nx, ny))) continue;
                    background[ni] = true;
                    queue[queueTail++] = ni;
                }
            }

            // Remove enclosed pale background areas (for example the openings
            // inside the 47 mark and the letter "o") without erasing the white
            // Team wordmark used by the dark-surface source.
            bool[] componentSeen = new bool[w * h];
            int[] component = new int[w * h];
            for (int startIndex = 0; startIndex < w * h; startIndex++) {
                if (background[startIndex] || componentSeen[startIndex]) continue;
                int sx = startIndex % w, sy = startIndex / w;
                if (!IsConnectedBackgroundCandidate(source.GetPixel(sx, sy))) continue;

                int componentHead = 0, componentTail = 0;
                component[componentTail++] = startIndex;
                componentSeen[startIndex] = true;
                int minX = sx, maxX = sx, minY = sy, maxY = sy;
                while (componentHead < componentTail) {
                    int idx = component[componentHead++];
                    int x = idx % w, y = idx / w;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                    for (int n = 0; n < 4; n++) {
                        int nx = x + dx[n], ny = y + dy[n];
                        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                        int ni = ny * w + nx;
                        if (background[ni] || componentSeen[ni]) continue;
                        if (!IsConnectedBackgroundCandidate(source.GetPixel(nx, ny))) continue;
                        componentSeen[ni] = true;
                        component[componentTail++] = ni;
                    }
                }

                double density = (double)componentTail / ((maxX - minX + 1) * (maxY - minY + 1));
                bool isWhiteTeam = preserveWhiteWord && minY > h * 0.68 && maxX < w * 0.62;
                bool isEnclosedBackground = density >= 0.52 && (maxX - minX) >= 6 && (maxY - minY) >= 6;
                if (isEnclosedBackground && !isWhiteTeam) {
                    for (int i = 0; i < componentTail; i++) background[component[i]] = true;
                }
            }

            using (Bitmap extracted = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
                extracted.SetResolution(source.HorizontalResolution, source.VerticalResolution);
                for (int y = 0; y < h; y++) {
                    for (int x = 0; x < w; x++) {
                        int idx = y * w + x;
                        Color c = source.GetPixel(x, y);
                        extracted.SetPixel(x, y, background[idx] ? Color.FromArgb(0, c.R, c.G, c.B) : Color.FromArgb(255, c.R, c.G, c.B));
                    }
                }
                using (Bitmap cropped = CropAlpha(extracted, 12)) {
                    cropped.Save(outputPath, ImageFormat.Png);
                }
            }
        }
    }

    static int FindStackSplit(Bitmap source) {
        int start = (int)(source.Height * 0.52);
        int end = (int)(source.Height * 0.90);
        int limit = Math.Max(2, (int)(source.Width * 0.002));
        int bestStart = -1, bestLength = 0, runStart = -1;
        for (int y = start; y <= end; y++) {
            int count = 0;
            for (int x = 0; x < source.Width; x++) if (source.GetPixel(x, y).A > 8) count++;
            if (count <= limit) {
                if (runStart < 0) runStart = y;
            } else if (runStart >= 0) {
                int length = y - runStart;
                if (length > bestLength) { bestLength = length; bestStart = runStart; }
                runStart = -1;
            }
        }
        if (runStart >= 0 && end + 1 - runStart > bestLength) { bestLength = end + 1 - runStart; bestStart = runStart; }
        return bestLength >= 3 ? bestStart + bestLength / 2 : (int)(source.Height * 0.73);
    }

    public static void SplitStacked(string inputPath, string markOutput, string wordOutput) {
        using (Bitmap source = new Bitmap(inputPath)) {
            int split = Math.Max(1, Math.Min(source.Height - 2, FindStackSplit(source)));
            using (Bitmap markRaw = source.Clone(new Rectangle(0, 0, source.Width, split), PixelFormat.Format32bppArgb))
            using (Bitmap wordRaw = source.Clone(new Rectangle(0, split, source.Width, source.Height - split), PixelFormat.Format32bppArgb))
            using (Bitmap mark = CropAlpha(markRaw, 10))
            using (Bitmap word = CropAlpha(wordRaw, 10)) {
                mark.Save(markOutput, ImageFormat.Png);
                word.Save(wordOutput, ImageFormat.Png);
            }
        }
    }

    static int FindWordSplit(Bitmap source) {
        int start = (int)(source.Width * 0.30);
        int end = (int)(source.Width * 0.72);
        int limit = Math.Max(1, (int)(source.Height * 0.02));
        int bestStart = -1, bestLength = 0, runStart = -1;
        for (int x = start; x <= end; x++) {
            int count = 0;
            for (int y = 0; y < source.Height; y++) if (source.GetPixel(x, y).A > 8) count++;
            if (count <= limit) {
                if (runStart < 0) runStart = x;
            } else if (runStart >= 0) {
                int length = x - runStart;
                if (length > bestLength) { bestLength = length; bestStart = runStart; }
                runStart = -1;
            }
        }
        if (runStart >= 0 && end + 1 - runStart > bestLength) { bestLength = end + 1 - runStart; bestStart = runStart; }
        return bestLength >= 2 ? bestStart + bestLength / 2 : (int)(source.Width * 0.48);
    }

    public static void WhiteTeamWordmark(string inputPath, string outputPath) {
        using (Bitmap source = new Bitmap(inputPath))
        using (Bitmap output = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb)) {
            int split = FindWordSplit(source);
            output.SetResolution(96, 96);
            for (int y = 0; y < source.Height; y++) {
                for (int x = 0; x < source.Width; x++) {
                    Color c = source.GetPixel(x, y);
                    output.SetPixel(x, y, x < split && c.A > 0 ? Color.FromArgb(c.A, 255, 255, 255) : c);
                }
            }
            output.Save(outputPath, ImageFormat.Png);
        }
    }

    static void Configure(Graphics g) {
        g.CompositingMode = CompositingMode.SourceCopy;
        g.CompositingQuality = CompositingQuality.HighQuality;
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        g.SmoothingMode = SmoothingMode.HighQuality;
    }

    public static void ResizeWidth(string inputPath, string outputPath, int width) {
        using (Bitmap source = new Bitmap(inputPath)) {
            int height = Math.Max(1, (int)Math.Round((double)source.Height * width / source.Width));
            using (Bitmap output = new Bitmap(width, height, PixelFormat.Format32bppArgb)) {
                output.SetResolution(96, 96);
                using (Graphics g = Graphics.FromImage(output)) {
                    Configure(g);
                    g.Clear(Color.Transparent);
                    g.DrawImage(source, new Rectangle(0, 0, width, height));
                }
                output.Save(outputPath, ImageFormat.Png);
            }
        }
    }

    public static void Square(string inputPath, string outputPath, int size, double occupancy) {
        using (Bitmap source = new Bitmap(inputPath))
        using (Bitmap output = new Bitmap(size, size, PixelFormat.Format32bppArgb)) {
            output.SetResolution(96, 96);
            int max = Math.Max(1, (int)Math.Round(size * occupancy));
            double scale = Math.Min((double)max / source.Width, (double)max / source.Height);
            int w = Math.Max(1, (int)Math.Round(source.Width * scale));
            int h = Math.Max(1, (int)Math.Round(source.Height * scale));
            int x = (size - w) / 2, y = (size - h) / 2;
            using (Graphics g = Graphics.FromImage(output)) {
                Configure(g);
                g.Clear(Color.Transparent);
                g.DrawImage(source, new Rectangle(x, y, w, h));
            }
            output.Save(outputPath, ImageFormat.Png);
        }
    }

    public static void Horizontal(string markPath, string wordPath, string outputPath) {
        using (Bitmap mark = new Bitmap(markPath))
        using (Bitmap word = new Bitmap(wordPath)) {
            int canvasHeight = 600, padding = 30, gap = 44;
            int markHeight = canvasHeight - padding * 2;
            int markWidth = (int)Math.Round((double)mark.Width * markHeight / mark.Height);
            int wordHeight = 170;
            int wordWidth = (int)Math.Round((double)word.Width * wordHeight / word.Height);
            int canvasWidth = padding + markWidth + gap + wordWidth + padding;
            using (Bitmap output = new Bitmap(canvasWidth, canvasHeight, PixelFormat.Format32bppArgb)) {
                output.SetResolution(96, 96);
                using (Graphics g = Graphics.FromImage(output)) {
                    Configure(g);
                    g.Clear(Color.Transparent);
                    g.DrawImage(mark, new Rectangle(padding, padding, markWidth, markHeight));
                    g.DrawImage(word, new Rectangle(padding + markWidth + gap, (canvasHeight - wordHeight) / 2, wordWidth, wordHeight));
                }
                output.Save(outputPath, ImageFormat.Png);
            }
        }
    }

    public static void Stacked(string markPath, string wordPath, string outputPath) {
        using (Bitmap mark = new Bitmap(markPath))
        using (Bitmap word = new Bitmap(wordPath)) {
            int padding = 12, gap = 22;
            int canvasWidth = Math.Max(mark.Width, word.Width) + padding * 2;
            int canvasHeight = padding + mark.Height + gap + word.Height + padding;
            using (Bitmap output = new Bitmap(canvasWidth, canvasHeight, PixelFormat.Format32bppArgb)) {
                output.SetResolution(96, 96);
                using (Graphics g = Graphics.FromImage(output)) {
                    Configure(g);
                    g.Clear(Color.Transparent);
                    g.DrawImage(mark, new Rectangle((canvasWidth - mark.Width) / 2, padding, mark.Width, mark.Height));
                    g.DrawImage(word, new Rectangle((canvasWidth - word.Width) / 2, padding + mark.Height + gap, word.Width, word.Height));
                }
                output.Save(outputPath, ImageFormat.Png);
            }
        }
    }
}
'@

if (-not ("Team47LogoKit" -as [type])) {
  $drawingReferences = @(
    [System.Drawing.Bitmap].Assembly.Location,
    [System.Drawing.Color].Assembly.Location,
    [System.Collections.Generic.Queue[int]].Assembly.Location,
    (Join-Path (Split-Path -Parent ([System.Drawing.Bitmap].Assembly.Location)) "System.Runtime.dll"),
    (Join-Path (Split-Path -Parent ([System.Drawing.Bitmap].Assembly.Location)) "System.Collections.dll"),
    (Join-Path (Split-Path -Parent ([System.Drawing.Bitmap].Assembly.Location)) "System.Private.Windows.GdiPlus.dll"),
    (Join-Path (Split-Path -Parent ([System.Drawing.Bitmap].Assembly.Location)) "System.Private.Windows.Core.dll")
  ) | Select-Object -Unique
  Add-Type -TypeDefinition $typeSource -ReferencedAssemblies $drawingReferences
}

$folders = @(
  "masters", "web\stacked", "web\horizontal", "web\wordmark", "web\mark",
  "android", "ios", "pwa"
)
foreach ($folder in $folders) {
  New-Item -ItemType Directory -Path (Join-Path $OutputRoot $folder) -Force | Out-Null
}

$lightStack = Join-Path $OutputRoot "masters\team47studio-stacked-light-surface-master-transparent.png"
$darkStack = Join-Path $OutputRoot "masters\team47studio-stacked-dark-surface-master-transparent.png"
[Team47LogoKit]::ExtractConnectedBackground($lightSource, $lightStack, $false)

$markMaster = Join-Path $OutputRoot "masters\team47studio-mark-master-transparent.png"
$lightWord = Join-Path $OutputRoot "masters\team47studio-wordmark-light-surface-master-transparent.png"
$darkWord = Join-Path $OutputRoot "masters\team47studio-wordmark-dark-surface-master-transparent.png"
[Team47LogoKit]::SplitStacked($lightStack, $markMaster, $lightWord)
[Team47LogoKit]::WhiteTeamWordmark($lightWord, $darkWord)
[Team47LogoKit]::Stacked($markMaster, $darkWord, $darkStack)

$lightHorizontal = Join-Path $OutputRoot "masters\team47studio-horizontal-light-surface-master-transparent.png"
$darkHorizontal = Join-Path $OutputRoot "masters\team47studio-horizontal-dark-surface-master-transparent.png"
[Team47LogoKit]::Horizontal($markMaster, $lightWord, $lightHorizontal)
[Team47LogoKit]::Horizontal($markMaster, $darkWord, $darkHorizontal)

$resizeJobs = @()
foreach ($item in @(
  @{ Key = "light"; Source = $lightStack },
  @{ Key = "dark"; Source = $darkStack }
)) {
  foreach ($width in @(1200, 800, 512, 320)) {
    $resizeJobs += @{ Source = $item.Source; Output = (Join-Path $OutputRoot "web\stacked\team47studio-stacked-$($item.Key)-surface-${width}w-transparent.png"); Width = $width }
  }
}
foreach ($item in @(
  @{ Key = "light"; Source = $lightHorizontal },
  @{ Key = "dark"; Source = $darkHorizontal }
)) {
  foreach ($width in @(1200, 800, 480, 320)) {
    $resizeJobs += @{ Source = $item.Source; Output = (Join-Path $OutputRoot "web\horizontal\team47studio-horizontal-$($item.Key)-surface-${width}w-transparent.png"); Width = $width }
  }
}
foreach ($item in @(
  @{ Key = "light"; Source = $lightWord },
  @{ Key = "dark"; Source = $darkWord }
)) {
  foreach ($width in @(800, 480, 320)) {
    $resizeJobs += @{ Source = $item.Source; Output = (Join-Path $OutputRoot "web\wordmark\team47studio-wordmark-$($item.Key)-surface-${width}w-transparent.png"); Width = $width }
  }
}
foreach ($job in $resizeJobs) {
  [Team47LogoKit]::ResizeWidth($job.Source, $job.Output, $job.Width)
}

foreach ($size in @(512, 256, 128, 64, 48, 32, 16)) {
  [Team47LogoKit]::Square($markMaster, (Join-Path $OutputRoot "web\mark\team47studio-mark-${size}x${size}-transparent.png"), $size, 0.88)
}

foreach ($size in @(1080, 512, 432, 192, 144, 96, 72, 48)) {
  $occupancy = if ($size -in @(1080, 432)) { 0.66 } else { 0.82 }
  [Team47LogoKit]::Square($markMaster, (Join-Path $OutputRoot "android\team47studio-android-${size}x${size}-transparent-source.png"), $size, $occupancy)
}

foreach ($size in @(1024, 180, 167, 152, 120, 87, 80, 76, 60, 58, 40)) {
  [Team47LogoKit]::Square($markMaster, (Join-Path $OutputRoot "ios\team47studio-ios-${size}x${size}-transparent-source.png"), $size, 0.82)
}

foreach ($size in @(512, 192, 180)) {
  [Team47LogoKit]::Square($markMaster, (Join-Path $OutputRoot "pwa\team47studio-pwa-${size}x${size}-transparent.png"), $size, 0.80)
}

$readme = @"
# Team47Studio Transparent Logo Kit

Created: November 5, 2026

This kit contains background-free PNG assets derived from the two supplied Team47Studio logos.

## Usage

- `light-surface`: dark Team lettering for white and pale backgrounds.
- `dark-surface`: white Team lettering for dark backgrounds.
- `stacked`: primary landing, splash, and presentation lockup.
- `horizontal`: portal header, navigation, and wide app layouts.
- `wordmark`: text-only placements where the 47 mark is already present.
- `mark`: favicon, avatar, compact navigation, and general brand mark.
- `android`: transparent launcher/adaptive foreground source sizes. Android adaptive icons still require a separately configured background layer.
- `ios`: transparent design source sizes only. Apple App Store app icons must be exported with an opaque background and no alpha before submission.
- `pwa`: transparent source icons. Maskable PWA icons should receive an approved opaque background before production use.

## Source integrity

The visible logo artwork, lettering, proportions, and colors are preserved from the supplied raster files. Only edge-connected pale background pixels were removed. Resized files use high-quality bicubic resampling.

See `manifest.csv` for dimensions, SHA-256 hashes, and transparency checks.
"@
[System.IO.File]::WriteAllText((Join-Path $OutputRoot "README.md"), $readme, [System.Text.UTF8Encoding]::new($false))

$rows = foreach ($file in Get-ChildItem -LiteralPath $OutputRoot -Recurse -File | Where-Object { $_.Extension -eq ".png" }) {
  $bitmap = [System.Drawing.Bitmap]::new($file.FullName)
  try {
    $cornerAlpha = $bitmap.GetPixel(0, 0).A
    [PSCustomObject]@{
      File = $file.FullName.Substring($OutputRoot.Length + 1)
      Width = $bitmap.Width
      Height = $bitmap.Height
      TransparentCorner = ($cornerAlpha -eq 0)
      Bytes = $file.Length
      SHA256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
    }
  } finally {
    $bitmap.Dispose()
  }
}
$rows | Sort-Object File | Export-Csv -LiteralPath (Join-Path $OutputRoot "manifest.csv") -NoTypeInformation -Encoding UTF8

$zipPath = "$OutputRoot.zip"
Compress-Archive -Path (Join-Path $OutputRoot "*") -DestinationPath $zipPath -Force

[PSCustomObject]@{
  OutputRoot = $OutputRoot
  ZipPath = $zipPath
  PngCount = @($rows).Count
  AllTransparentCorners = (@($rows | Where-Object { -not $_.TransparentCorner }).Count -eq 0)
  TotalBytes = (Get-ChildItem -LiteralPath $OutputRoot -Recurse -File | Measure-Object Length -Sum).Sum
}
