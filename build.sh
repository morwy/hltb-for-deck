#!/usr/bin/env bash
set -e

echo "Starting build process."

if [ -d dist ]; then
    echo "Found existing distribution package folder, removing."
    rm -rf dist
fi

if [ -d hltb-for-deck ]; then
    echo "Found existing distribution package folder, removing."
    rm -rf hltb-for-deck
fi

if [ -f hltb-for-deck.zip ]; then
    echo "Found existing distribution package zip, removing."
    rm -f hltb-for-deck.zip
fi

if [ -f hltb-for-deck.tar.gz ]; then
    echo "Found existing distribution package tarball, removing."
    rm -f hltb-for-deck.tar.gz
fi

echo "Installing dependencies."
npm install -g pnpm
pnpm install

echo "Running build script."
pnpm run build

echo "Preparing distribution package contents."
cp -f "plugin.json" "./dist/"
cp -f "package.json" "./dist/"
mkdir -p ./dist/dist
rm -f "./dist/index.js.map"
mv ./dist/index.js ./dist/dist/
mv ./dist ./hltb-for-deck

echo "Creating distribution package zip."
zip -r hltb-for-deck.zip hltb-for-deck

echo "Finished build process."
