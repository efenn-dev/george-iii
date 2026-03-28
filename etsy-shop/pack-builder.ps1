# pack-builder.ps1
# Swag Nuggets Etsy Pack Builder
# Usage: cd C:\Users\efenn\.openclaw\workspace\etsy-shop && .\pack-builder.ps1

$outputBase = "$PSScriptRoot\ready-to-upload"
New-Item -ItemType Directory -Force -Path $outputBase | Out-Null

$licenseText = @"
LICENSE & README
================
By Swag Nuggets Designs

COMMERCIAL USE LICENSE:
- OK: Use on physical printed products (t-shirts, mugs, stickers, tote bags, etc.)
- OK: Sell on POD platforms (Printify, Printful, Redbubble, Merch by Amazon, etc.)
- NOT OK: Resell or redistribute these digital files
- NOT OK: Claim as your own original artwork

COMPATIBLE PLATFORMS:
Printify, Printful, Printbase, Redbubble, Teespring, Merch by Amazon,
Cricut Design Space, Silhouette Studio, any DTG/sublimation printer

QUESTIONS? Message us through Etsy!

Thank you for your purchase - Swag Nuggets Designs
"@

function Build-Pack {
    param(
        [string]$PackName,
        [string[]]$FilePaths,
        [string[]]$WildcardPaths
    )

    Write-Host "`nBuilding: $PackName..." -ForegroundColor Yellow
    $packDir = Join-Path $outputBase $PackName
    New-Item -ItemType Directory -Force -Path $packDir | Out-Null

    $copied = 0
    $missing = 0

    # Copy explicit files
    foreach ($file in $FilePaths) {
        if (Test-Path -LiteralPath $file) {
            Copy-Item -LiteralPath $file -Destination $packDir -Force
            $copied++
        } else {
            Write-Host "  MISSING: $file" -ForegroundColor Red
            $missing++
        }
    }

    # Copy wildcard paths
    foreach ($pattern in $WildcardPaths) {
        $found = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue
        foreach ($f in $found) {
            Copy-Item -LiteralPath $f.FullName -Destination $packDir -Force
            $copied++
        }
    }

    # Write license
    $licenseText | Out-File -FilePath (Join-Path $packDir "README-LICENSE.txt") -Encoding utf8

    # ZIP it
    $zipPath = Join-Path $outputBase "$PackName.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath }
    Compress-Archive -Path "$packDir\*" -DestinationPath $zipPath

    $status = if ($missing -eq 0) { "OK" } else { "PARTIAL ($missing missing)" }
    Write-Host "  $copied files | Status: $status | ZIP: $(Split-Path $zipPath -Leaf)" -ForegroundColor $(if ($missing -eq 0) { "Green" } else { "DarkYellow" })
}

Write-Host "`n=== Swag Nuggets Pack Builder ===" -ForegroundColor Cyan

# PACK 1 — Funny Humor (15 designs)
Build-Pack -PackName "Pack1_FunnyHumorTeeDesigns" -FilePaths @(
    "D:\Pictures\T-shirt designs\funny shirts\Design1.png",
    "D:\Pictures\T-shirt designs\funny shirts\Design2.png",
    "D:\Pictures\T-shirt designs\funny shirts\Design3.png",
    "D:\Pictures\T-shirt designs\funny shirts\Design4.png",
    "D:\Pictures\T-shirt designs\funny shirts\Design5.png",
    "D:\Pictures\T-shirt designs\funny shirts\Design6.png",
    "D:\Pictures\T-shirt designs\funny shirts\Design7.png",
    "D:\Pictures\T-shirt designs\funny shirts\Design8.png",
    "D:\Pictures\T-shirt designs\funny shirts\Design9.png",
    "D:\Pictures\T-shirt designs\funny shirts\Design10.png",
    "D:\Pictures\T-shirt designs\funny shirts\Design11.png",
    "D:\Pictures\T-shirt designs\funny shirts\Design12.png",
    "D:\Pictures\T-shirt designs\funny shirts\Design13.png",
    "D:\Pictures\T-shirt designs\funny shirts\Design14.png",
    "D:\Pictures\T-shirt designs\funny shirts\Design15.png"
)

# PACK 2 — Christian Faith (7 designs)
Build-Pack -PackName "Pack2_ChristianFaithTeeDesigns" -FilePaths @(
    "D:\Pictures\T-shirt designs\christian shirts\chosen.png",
    "D:\Pictures\T-shirt designs\christian shirts\christ.png",
    "D:\Pictures\T-shirt designs\christian shirts\focused.png",
    "D:\Pictures\T-shirt designs\christian shirts\HUMBLEYOURSELF.png",
    "D:\Pictures\T-shirt designs\christian shirts\unashamed.png",
    "D:\Pictures\T-shirt designs\christian shirts\workplaypray.png",
    "D:\Pictures\T-shirt designs\christian shirts\worldmap.png"
)

# PACK 3 — Texas Pride (6 designs)
Build-Pack -PackName "Pack3_TexasPrideTeeDesigns" -FilePaths @(
    "D:\Pictures\T-shirt designs\Texas T Ideas\TexasTee_Black.png",
    "D:\Pictures\T-shirt designs\Texas T Ideas\TexasTee_White.png",
    "D:\Pictures\T-shirt designs\Texas T Ideas\LoveTx.png",
    "D:\Pictures\T-shirt designs\Texas T Ideas\LoveTxOutline.png",
    "D:\Pictures\T-shirt designs\Texas T Ideas\LoveTxWhite.png",
    "D:\Pictures\T-shirt designs\Texas T Ideas\LoveTxWhite2.png"
)

# PACK 4 — Christmas Holiday (6 designs)
Build-Pack -PackName "Pack4_ChristmasHolidayTeeDesigns" -FilePaths @(
    "D:\Pictures\Holidays\Christmas\Kiss me you fool on Black.png",
    "D:\Pictures\Holidays\Christmas\Kiss me you fool on White.png",
    "D:\Pictures\Holidays\Christmas\Kiss me you fool.png",
    "D:\Pictures\Holidays\Christmas\Cat that stole Christmas.png",
    "D:\Pictures\T-shirt designs\DontStopBelievingSanta\DontStopBelievingSanta2.png",
    "D:\Pictures\Holidays\Christmas\Christmas Socks 1.png"
)

# PACK 5 — Pop Art Animals (uses wildcard for DALL-E filenames with special chars)
Build-Pack -PackName "Pack5_PopArtAnimalDesigns" -FilePaths @(
    "D:\Pictures\top picks\Final Space Cat - Hyperspeed Kitty v3.png"
) -WildcardPaths @(
    "D:\Pictures\top picks\DALL* turtle*.png",
    "D:\Pictures\top picks\DALL* pug*.png",
    "D:\Pictures\top picks\DALL* cat in a spacesuit*.png",
    "D:\Pictures\top picks\DALL* banana*.png"
)

# PACK 6 — Humor Stickers (8 designs)
Build-Pack -PackName "Pack6_HumorStickerPack" -FilePaths @(
    "D:\Pictures\Stickers\Good Job Jesus Big.png",
    "D:\Pictures\Stickers\Good Job Jesus Big copy Woke up.png",
    "D:\Pictures\Stickers\Good Job Jesus Big copy Woke up v2.png",
    "D:\Pictures\Stickers\Good Job Jesus Big copy Woke up v3.png",
    "D:\Pictures\Stickers\Sendit Final sticker.png",
    "D:\Pictures\Stickers\Einstein1 Large.png",
    "D:\Pictures\Stickers\Einstein2 Large.png",
    "D:\Pictures\Stickers\Oops I gorillagain Final.png"
)

# PACK 7 — Social Humor OG Designs (5 designs)
Build-Pack -PackName "Pack7_SocialHumorOGDesigns" -FilePaths @(
    "D:\Pictures\OG Content\Social_Distance_Dogs.png",
    "D:\Pictures\OG Content\headbanger3.png",
    "D:\Pictures\OG Content\Swag_Turtle.png",
    "D:\Pictures\OG Content\THE PROPHECYv69swagFINALFORM.png",
    "D:\Pictures\OG Content\headbanger2.png"
)

# PACK 8 — Most Excellent Car (4 designs)
Build-Pack -PackName "Pack8_MostExcellentCarDesigns" -FilePaths @(
    "D:\Pictures\T-shirt designs\Most excellent\mostExcellent1.png",
    "D:\Pictures\T-shirt designs\Most excellent\mostExcellent2good.png",
    "D:\Pictures\T-shirt designs\Most excellent\mostExcellent2goodCar.png",
    "D:\Pictures\T-shirt designs\Most excellent\mostExcellent2goodCar2.png"
)

Write-Host "`n=== Done! ===" -ForegroundColor Cyan
Write-Host "ZIP files ready in: $outputBase"
Write-Host "Upload each ZIP to its Etsy listing as the digital download file."
Write-Host "Listing templates: $PSScriptRoot\listings\listing-templates.md`n"
