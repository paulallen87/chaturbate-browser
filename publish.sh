#/bin/bash

VERSION="$(npm info . version)"
COMMENT=

git add .
git status

echo 'Comment: '
read COMMENT

git commit -m "${COMMENT}"
git tag "v${VERSION}"
git push origin master --tags

npm publish --access=public