@echo off
rem Change to the MatchScheduler project directory
cd /d "%~dp0\MatchScheduler"
echo Deleting old code files...
rem 1. Delete all .js and .html files
del /q *.js *.html
rem 2. Carefully delete only non-essential .json files
for %%F in (*.json) do (
    if /I not "%%F"==".clasp.json" if /I not "%%F"=="appsscript.json" (
        del "%%F"
    )
)
echo Pulling latest code from Google Apps Script...
clasp pull
echo Done.
pause