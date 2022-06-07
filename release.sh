#!/bin/bash
set -e # fail on EVERYTHING

echo "starting release"

# 0. check for uncommitted files
set +e
git status | grep "Changes not staged for commit:"
status=$?
set -e

if [ $status == 0 ]; then
    echo "there are changes not committed, refusing to version in uncertain state"
    exit 255
else
    echo "all changes have been committed, continuing..."
fi

# 1. get version number
oldversionname=`grep '"version_name":' chrome/manifest.json | sed 's/"version_name": "\([^"]*\)",/\1/g' | tr -d '[:space:]'`
echo discovered existing version $oldversionname

if [[ $oldversionname == *"-development" ]]; then
    echo "adapting for development version"
    releaseversionname=`echo $oldversionname | sed 's/-development//g'`
else
    echo "No development version, something is wrong, exiting..."
    exit 255
fi

# 2. update version number in file
echo "updating $oldversionname to $releaseversionname for release"
sed "s?\"version_name\": \"$oldversionname\",?\"version_name\": \"$releaseversionname\",?g" chrome/manifest.json > chrome/manifest.json.new
sed "s?\"version\": \"[0-9.]*.9999\",?\"version\": \"$releaseversionname\",?g" chrome/manifest.json.new > chrome/manifest.json.new2
mv chrome/manifest.json.new2 chrome/manifest.json
rm chrome/manifest.json.new

# 3. commit file
echo "committing version $version"
git add chrome/manifest.json
git commit -m "raising version to release version $version"

# 4. create tag
echo "tagging version $version"
git tag -a v${version} -m "tagging version ${version}"

# 5. generate new version
ver=(${releaseversionname//./ })
nextpatchver=$((${ver[2]} + 1))
nextversion="${ver[0]}.${ver[1]}.$nextpatchver-development"
echo next version is $nextversion

# 6. update version number in file
echo "updating $releaseversionname to $nextversion for release"
sed "s?\"version_name\": \"$releaseversionname\",?\"version_name\": \"$nextversion\",?g" chrome/manifest.json > chrome/manifest.json.new
sed "s?\"version\": \"$releaseversionname\",?\"version\": \"$releaseversionname.9999\",?g" chrome/manifest.json.new > chrome/manifest.json.new2
mv chrome/manifest.json.new2 chrome/manifest.json
rm chrome/manifest.json.new

# 7. commit file
git add chrome/manifest.json
git commit -m "raising version to development version $version"

echo "done with release"