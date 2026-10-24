#!/bin/zsh
# Build a native macOS wrapper for 拾词 (WKWebView, no browser window).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${HOME}/Applications/拾词.app"
BUNDLE_CONTENTS="${APP}/Contents"

if [ ! -f "${ROOT}/public/pwa-512x512.png" ]; then
  echo "缺少 public/pwa-512x512.png，请先生成图标。" >&2
  exit 1
fi

NPM_PATH="$(command -v npm || true)"
if [ -z "${NPM_PATH}" ]; then
  NPM_PATH="/Users/m.w/.nvm/versions/node/v24.22.0/bin/npm"
fi

mkdir -p "${BUNDLE_CONTENTS}/MacOS" "${BUNDLE_CONTENTS}/Resources"
rm -f "${BUNDLE_CONTENTS}/MacOS/launcher"

cp "${ROOT}/desktop/Info.plist" "${BUNDLE_CONTENTS}/Info.plist"

cat > "${BUNDLE_CONTENTS}/Resources/config.json" <<EOF
{
  "projectDir": "${ROOT}",
  "npmPath": "${NPM_PATH}"
}
EOF

# Generate the .icns icon from the PWA icon.
ICONSET="$(mktemp -d)/AppIcon.iconset"
mkdir -p "${ICONSET}"
for size in 16 32 128 256 512; do
  sips -z "${size}" "${size}" "${ROOT}/public/pwa-512x512.png" \
    --out "${ICONSET}/icon_${size}x${size}.png" >/dev/null
  sips -z "$((size * 2))" "$((size * 2))" "${ROOT}/public/pwa-512x512.png" \
    --out "${ICONSET}/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "${ICONSET}" -o "${BUNDLE_CONTENTS}/Resources/appicon.icns"
rm -rf "$(dirname "${ICONSET}")"

# The default SDK on some Command Line Tools installs is newer than the Swift
# compiler. Prefer a matching 26.x SDK when present so the build is stable.
SDK_PATH="$(xcrun --show-sdk-path 2>/dev/null || true)"
if [ -d "/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk" ]; then
  SDK_PATH="/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk"
fi
ARCH="$(uname -m)"

echo "编译原生窗口…（SDK: ${SDK_PATH}）"
swiftc -sdk "${SDK_PATH}" -target "${ARCH}-apple-macos13.0" \
  -swift-version 5 -O "${ROOT}/desktop/main.swift" \
  -o "${BUNDLE_CONTENTS}/MacOS/Shici" \
  -framework Cocoa -framework WebKit -framework UserNotifications

chmod +x "${BUNDLE_CONTENTS}/MacOS/Shici"

if command -v codesign >/dev/null 2>&1; then
  codesign --force --deep --sign - "${APP}" >/dev/null 2>&1 || true
fi

touch "${APP}"
ln -sfn "${APP}" "${HOME}/Desktop/拾词.app"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
  -f "${APP}" >/dev/null 2>&1 || true

echo "已生成原生 App：${APP}"
echo "桌面快捷方式：${HOME}/Desktop/拾词.app"
