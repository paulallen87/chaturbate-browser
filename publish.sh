#/bin/bash

#yarn lint || exit 0;
yarn test || exit 0;

VERSION="$(node -p "require('./package.json').version")"
CURRENT_VERSION="$(npm info . version)"
COMMENT=

git add . || exit 1
git status

echo "Comment (${CURRENT_VERSION} -> ${VERSION}): "
read COMMENT

git commit -m "${COMMENT}" || exit 1

if [ "${VERSION}" != "${CURRENT_VERSION}" ]; then
  echo "creating new git tag for ${VERSION}"
  git tag "v${VERSION}" || exit 1
else
  echo "skipping git tag"
fi

git push origin master --tags || exit 1

if [ "${VERSION}" != "${CURRENT_VERSION}" ]; then
  echo "${CURRENT_VERSION} -> ${VERSION}"
  npm publish --access=public
else
  echo "Versions are the same, not publishing"
fi