#!/usr/bin/env sh
# Fails if the dev-only fake API (mocks/) is in a release JS bundle.
#
#   sh scripts/check-release-bundle.sh              # export a production bundle and scan it
#   sh scripts/check-release-bundle.sh app.apk      # scan the bundle embedded in a built APK
#
# Hermes bytecode keeps string literals, so the markers are found in .hbc too.
set -eu

# Strings only mocks/ contains (see DEV_MOCKS_MARKER in mocks/index.ts).
MARKERS='__IIP_DEV_MOCKS__|dev-sso-code|field@iip\.example\.org'

out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT

if [ $# -gt 0 ]; then
  unzip -p "$1" assets/index.android.bundle >"$out/index.android.bundle"
  if [ ! -s "$out/index.android.bundle" ]; then
    echo "No JS bundle found in $1" >&2
    exit 1
  fi
else
  APP_VARIANT=production EXPO_PUBLIC_API_MOCKING=disabled \
    npx expo export --platform android --output-dir "$out" >/dev/null
fi

if grep -rqaE "$MARKERS" "$out"; then
  echo "Release bundle contains dev mock code (mocks/). Import it only as @/mocks." >&2
  exit 1
fi
echo "Release bundle is free of dev mocks."
