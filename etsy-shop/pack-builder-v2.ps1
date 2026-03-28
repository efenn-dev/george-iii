# pack-builder-v2.ps1 — New packs from AI Art Finals
$outputBase = "C:\Users\efenn\.openclaw\workspace\etsy-shop\ready-to-upload"

$licenseText = @"
LICENSE & README - Swag Nuggets Designs
Commercial use permitted for printed physical products.
Resale of digital files NOT permitted.
Works with: Printify, Printful, Redbubble, Cricut, Silhouette, any DTG/sublimation.
"@

function Build-Pack {
    param([string]$PackName, [string[]]$Globs, [string[]]$ExactFiles)
    Write-Host "`nBuilding: $PackName..." -ForegroundColor Yellow
    $packDir = Join-Path $outputBase $PackName
    New-Item -ItemType Directory -Force -Path $packDir | Out-Null
    $copied = 0

    foreach ($file in $ExactFiles) {
        if (Test-Path -LiteralPath $file) {
            $dest = Join-Path $packDir (Split-Path $file -Leaf)
            Copy-Item -LiteralPath $file -Destination $dest -Force
            $copied++
        } else { Write-Host "  MISSING: $file" -ForegroundColor Red }
    }
    foreach ($pattern in $Globs) {
        Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | ForEach-Object {
            Copy-Item -LiteralPath $_.FullName -Destination $packDir -Force; $copied++
        }
    }

    $licenseText | Out-File -FilePath (Join-Path $packDir "README-LICENSE.txt") -Encoding utf8
    $zipPath = Join-Path $outputBase "$PackName.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath }
    Compress-Archive -Path "$packDir\*" -DestinationPath $zipPath
    Remove-Item $packDir -Recurse -Force
    Write-Host "  $copied files | ZIP: $(Split-Path $zipPath -Leaf)" -ForegroundColor Green
}

Write-Host "=== Swag Nuggets Pack Builder v2 ===" -ForegroundColor Cyan

# PACK 9 — Space Cat Designs (best finals from DallE + Midjourney)
Build-Pack -PackName "Pack9_SpaceCatDesigns" -ExactFiles @(
    "D:\Pictures\AI Art\DallE\Finals\Space Cats\cat space nebula 1\FINAL.png",
    "D:\Pictures\AI Art\DallE\Finals\Space Cats\cat space nebula 1\FINALFINALBIGBOINEBULA.png",
    "D:\Pictures\AI Art\DallE\Finals\Space Cats\cat space nebula 1\finalspacesuitcat2-FINAL.png",
    "D:\Pictures\AI Art\DallE\Finals\Space Cats\cat space nebula 1\finalspacesuitcat2-FINAL2.png",
    "D:\Pictures\AI Art\DallE\Finals\Space Cats\cat space nebula 1\finalspacesuitcat-NoBlack.png",
    "D:\Pictures\AI Art\DallE\Finals\Space Cats\Hyperspeed Kitty\Final Space Cat - Hyperspeed Kitty v3.png",
    "D:\Pictures\AI Art\DallE\Finals\Space Cats\Space Assault Kity\Space Assault Kitty Final2ndAI.png",
    "D:\Pictures\AI Art\Midjourney\FINALs\animals\cats\FINAFINAL Legendary Shredder.png",
    "D:\Pictures\AI Art\Midjourney\FINALs\animals\cats\FINAFINALvFInal.png",
    "D:\Pictures\AI Art\Midjourney\FINALs\animals\cats\Final Surfer Cat.png"
)

# PACK 10 — Stoner/420 Designs
Build-Pack -PackName "Pack10_StonerDesigns" -ExactFiles @(
    "D:\Pictures\AI Art\DallE\Finals\Stoners\Final\DontWantThisSmoke FINAL.png",
    "D:\Pictures\AI Art\DallE\Finals\Stoners\Final\DontWantThisSmoke FINAL copy.png",
    "D:\Pictures\AI Art\DallE\Finals\Stoners\Final\Final Relaxing Pot Smoke Girl copy 3.png",
    "D:\Pictures\AI Art\DallE\Finals\Stoners\Final\FinalOldManChoke.png",
    "D:\Pictures\AI Art\DallE\Finals\Stoners\Final\MySmokeFinalcopy.png"
)

# PACK 11 — Space & Astronaut Designs (Midjourney)
Build-Pack -PackName "Pack11_SpaceAstronautDesigns" -ExactFiles @(
    "D:\Pictures\AI Art\Midjourney\FINALs\Space\Just Ring Careful with FINAL.png",
    "D:\Pictures\AI Art\Midjourney\FINALs\Space\Pony\neon_line_astronaut1 copy FINAL.png",
    "D:\Pictures\AI Art\Midjourney\FINALs\Space\surfer1\Astronaut Surfer v6 Final.png"
)

# PACK 12 — Tropical/Beach Vibes (Stay Palm + Dinos + Turtle)
Build-Pack -PackName "Pack12_TropicalVibesDesigns" -ExactFiles @(
    "D:\Pictures\AI Art\Midjourney\FINALs\Stay Palm\Stay Palm Final.png",
    "D:\Pictures\AI Art\Midjourney\FINALs\Stay Palm\Stay Palm Final 2.png",
    "D:\Pictures\AI Art\Midjourney\FINALs\Stay Palm\Stay Palm Final 3.2 copy Final.png",
    "D:\Pictures\AI Art\Midjourney\FINALs\animals\Dinos\FINAL METEOR AWARENESS.png",
    "D:\Pictures\AI Art\Midjourney\FINALs\animals\Dinos\Surfs Up Dino1.1 Aqua Final 1.png",
    "D:\Pictures\AI Art\Midjourney\FINALs\animals\Dinos\Surfs Up Dino1.1 White Final 1.png",
    "D:\Pictures\AI Art\Midjourney\FINALs\animals\Turtle\Final Flying Turtle city.png"
)

# PACK 13 — Funny AI Art Designs (DallE Funny finals)
Build-Pack -PackName "Pack13_FunnyAIArtDesigns" -ExactFiles @(
    "D:\Pictures\AI Art\DallE\Finals\Funny\FINAL Black - The Matter Baby v3 CAP.png",
    "D:\Pictures\AI Art\DallE\Finals\Funny\FINAL White - The Matter Baby CAP.png",
    "D:\Pictures\AI Art\DallE\Finals\Funny\BacksidePlayground a3 Final.png",
    "D:\Pictures\AI Art\DallE\Finals\Funny\ICONFINAL.png",
    "D:\Pictures\AI Art\DallE\Finals\Funny\iconic FINALmeThinks.png",
    "D:\Pictures\AI Art\DallE\Finals\Funny\iconic Plain FInal.png",
    "D:\Pictures\AI Art\DallE\Finals\Funny\WHatIfthisISITv1FINALLLL.png",
    "D:\Pictures\AI Art\DallE\Finals\Funny\iconic Day2V1 money color v4 FINAL.png"
)

# PACK 14 — Shaka Jesus / Hang Loose Designs 
Build-Pack -PackName "Pack14_ShakaJesusDesigns" -ExactFiles @(
    "D:\Pictures\AI Art\DallE\Finals\SHAKABRAH Jesus\Final Folder\finalonBlack1FINAFINAL.png",
    "D:\Pictures\AI Art\DallE\Finals\SHAKABRAH Jesus\Final Folder\finalonWhite1.png",
    "D:\Pictures\AI Art\DallE\Finals\SHAKABRAH Jesus\Jesus Shaka Brah3.2FinalTee 3 FINALFORM.png",
    "D:\Pictures\AI Art\DallE\Finals\SHAKABRAH Jesus\Jesus Shaka Brah3.2FinalTee 4 FINALFORM 2.png",
    "D:\Pictures\AI Art\DallE\Finals\SHAKABRAH Jesus\26NOV\HangLooseYellow copy - Copy copy FInal 12-3 copy Swag Colors.png",
    "D:\Pictures\AI Art\DallE\Finals\SHAKABRAH Jesus\21NOVPlay\Black Jesus Final.png"
)

# PACK 15 — Badass/Edgy Designs (IAMADANGER + Waterslide Success)
Build-Pack -PackName "Pack15_BadassEdgyDesigns" -ExactFiles @(
    "D:\Pictures\AI Art\DallE\Finals\IAMADANGER\FINAL1.2.png",
    "D:\Pictures\AI Art\DallE\Finals\IAMADANGER\FINAL1.png",
    "D:\Pictures\AI Art\DallE\Finals\IAMADANGER\FINAL1WhiteWork1FINAL.png",
    "D:\Pictures\AI Art\DallE\Finals\IAMADANGER\BCStartMidIAMADANGACloseFinalFinal.png",
    "D:\Pictures\AI Art\DallE\Finals\Waterslide of success\Final1.png",
    "D:\Pictures\AI Art\DallE\Finals\Waterslide of success\Final1.2.png",
    "D:\Pictures\AI Art\DallE\Finals\Waterslide of success\Final1.3.png"
)

Write-Host "`n=== Done! ===" -ForegroundColor Cyan
Write-Host "New packs ready in: $outputBase"
Get-ChildItem $outputBase -Filter "*.zip" | Select-Object Name, @{N='SizeMB';E={[math]::Round($_.Length/1MB,1)}} | Format-Table -AutoSize
