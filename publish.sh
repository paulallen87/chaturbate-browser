#/bin/bash

VERSION="$(node -p "require('./package.json').version")"
COMMENT=

git add . || exit 1
git status

echo "Comment (${VERSION}): "
read COMMENT

git commit -m "${COMMENT}" || exit 1
git tag "v${VERSION}" || exit 1
git push origin master --tags || exit 1

npm publish --access=public