$inputFile  = 'C:\kiberaz.az\seed-data\quiz-questions.json'
$json = Get-Content $inputFile -Raw -Encoding UTF8 | ConvertFrom-Json
$output = $json | ConvertTo-Json -Depth 10
$enc = New-Object System.Text.UTF8Encoding $false   # $false = no BOM
[System.IO.File]::WriteAllText($inputFile, $output, $enc)
Write-Host "UTF-8 (no BOM) - Done!"
