#!/bin/bash
echo "🚀 Pushing OBD2 Pro to GitHub..."

# Go to project directory
cd /home/workdir/artifacts/obd2-pro

# Ensure git is initialized and remote is set
if [ ! -d ".git" ]; then
  git init
fi

git remote add origin https://github.com/oreddoug1992-code/stupidfuckingbitch.git 2>/dev/null || true
git remote set-url origin https://github.com/oreddoug1992-code/stupidfuckingbitch.git

# Add all files
git add .

# Commit
git commit -m "Initial commit: OBD2 Pro - Full Bluetooth ELM327 Android App" 2>/dev/null || echo "✅ Nothing new to commit"

# Push
echo "Pushing to GitHub..."
git push -u origin main --force

echo "✅ Done! Check your repo: https://github.com/oreddoug1992-code/stupidfuckingbitch"
