@echo off
chcp 65001 >nul
echo === Starting Deployment === > deploy_log.txt
git add . >> deploy_log.txt 2>&1
echo. >> deploy_log.txt
echo === Committing === >> deploy_log.txt
git commit -m "Auto Update" >> deploy_log.txt 2>&1
echo. >> deploy_log.txt
echo === Pushing to GitHub === >> deploy_log.txt
git push >> deploy_log.txt 2>&1
echo. >> deploy_log.txt
echo === DONE_UPLOADING === >> deploy_log.txt
