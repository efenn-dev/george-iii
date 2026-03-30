$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$backupDir = "D:\Backups\openclaw"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

cd "C:\Users\efenn\.openclaw"

# Workspace backup (core files only, skip design assets to keep it small)
$coreFiles = Get-ChildItem "workspace" -Recurse -File | Where-Object {
    $_.DirectoryName -notmatch "node_modules|ready-to-upload|packs|\.git" -and
    $_.Extension -match "\.(md|json|ps1|py|js|jsx|css|html|bat|txt)$"
}
Compress-Archive -Path ($coreFiles.FullName) -DestinationPath "$backupDir\workspace-core-$timestamp.zip" -Force

# Config backup
Copy-Item "openclaw.json" "$backupDir\openclaw-$timestamp.json"

# Keep only last 4 backups (1 month of weekly)
Get-ChildItem $backupDir -Filter "workspace-core-*.zip" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 4 | Remove-Item -Force
Get-ChildItem $backupDir -Filter "openclaw-*.json" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 4 | Remove-Item -Force
