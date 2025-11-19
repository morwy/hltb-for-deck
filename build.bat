@echo off

echo Starting build process.

if EXIST dist (
    echo Found existing distribution package folder, removing.
    rmdir /s /q dist
)

if EXIST hltb-for-deck (
    echo Found existing distribution package folder, removing.
    rmdir /s /q hltb-for-deck
)

if EXIST hltb-for-deck.zip (
    echo Found existing distribution package zip, removing.
    del hltb-for-deck.zip
)

if EXIST hltb-for-deck.tar.gz (
    echo Found existing distribution package tarball, removing.
    del hltb-for-deck.tar.gz
)

echo Installing dependencies.
cmd /c npm install -g pnpm
cmd /c pnpm install

echo Running build script.
cmd /c pnpm run build

echo Preparing distribution package contents.
copy /Y "plugin.json" ".\\dist\\"
copy /Y "package.json" ".\\dist\\"
mkdir .\\dist\\dist
del /f /q ".\\dist\\index.js.map"
move .\\dist\\index.js .\\dist\\dist\\
move .\\dist .\\hltb-for-deck

echo Creating distribution package zip.
tar.exe -a -cf hltb-for-deck.zip hltb-for-deck

echo Finished build process.