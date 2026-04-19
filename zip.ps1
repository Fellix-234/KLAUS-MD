Compress-Archive -Path * -DestinationPath klaus-md.zip -Force -Update
$zipPath = "klaus-md.zip"

Write-Host "Cleaning up unnecessary folders from the zip..."
# To cleanly zip while ignoring heavy folders
$exclude = @("node_modules", "session", ".git", "klaus-md.zip")
$filesToZip = Get-ChildItem -Path . -Exclude $exclude | Select-Object -ExpandProperty FullName

Compress-Archive -Path $filesToZip -DestinationPath bot-source.zip -Force
Write-Host "Bot packaged successfully as bot-source.zip!"
