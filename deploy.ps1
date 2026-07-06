# Deploy to GitHub Pages
# Run: powershell -ExecutionPolicy Bypass -File deploy.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$gh = "C:\Program Files\GitHub CLI\gh.exe"
if (-not (Test-Path $gh)) { $gh = "gh" }

& $gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Login to GitHub first:"
  & $gh auth login -h github.com -p https -w
}

$repoName = "nashe-chudo"
git branch -M main

& $gh repo view $repoName 2>$null
if ($LASTEXITCODE -ne 0) {
  & $gh repo create $repoName --public --source=. --remote=origin --description "Nashe Chudo pregnancy site" --push
} else {
  git push -u origin main
}

$user = & $gh api user -q .login
& $gh api -X POST "repos/$user/$repoName/pages" -f "source[branch]=main" -f "source[path]=/" 2>$null

Write-Host ""
Write-Host "Site URL (wait 1-2 min):"
Write-Host "https://$user.github.io/$repoName/"
