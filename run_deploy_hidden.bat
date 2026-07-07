@echo off
chcp 65001 >nul
echo === Starting Deployment === > "C:\Users\moshe\Desktop\גמח שמלות חדש\gemach-app\deploy_log.txt"
git add . >> "C:\Users\moshe\Desktop\גמח שמלות חדש\gemach-app\deploy_log.txt" 2>&1
echo. >> "C:\Users\moshe\Desktop\גמח שמלות חדש\gemach-app\deploy_log.txt"
echo === Committing === >> "C:\Users\moshe\Desktop\גמח שמלות חדש\gemach-app\deploy_log.txt"
git commit -m "Auto Update" >> "C:\Users\moshe\Desktop\גמח שמלות חדש\gemach-app\deploy_log.txt" 2>&1
echo. >> "C:\Users\moshe\Desktop\גמח שמלות חדש\gemach-app\deploy_log.txt"
echo === Pushing to GitHub === >> "C:\Users\moshe\Desktop\גמח שמלות חדש\gemach-app\deploy_log.txt"
git push >> "C:\Users\moshe\Desktop\גמח שמלות חדש\gemach-app\deploy_log.txt" 2>&1
echo. >> "C:\Users\moshe\Desktop\גמח שמלות חדש\gemach-app\deploy_log.txt"
echo === DONE_UPLOADING === >> "C:\Users\moshe\Desktop\גמח שמלות חדש\gemach-app\deploy_log.txt"
