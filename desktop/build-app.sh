#!/bin/bash
# 把宝宝表情包打包成独立 app 并安装到 /Applications
set -e
cd "$(dirname "$0")"
DIST="node_modules/electron/dist/Electron.app"
DEST="/Applications/宝宝表情包.app"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

# 1. 以 Electron 发行包为底
cp -R "$DIST" "$STAGE/宝宝表情包.app"

# 2. 注入应用代码与贴纸
APP="$STAGE/宝宝表情包.app/Contents/Resources/app"
mkdir -p "$APP"
cp package.json main.js preload.js overlay.html summon.html "$APP/"
cp -R stickers "$APP/stickers"
rm -f "$STAGE/宝宝表情包.app/Contents/Resources/default_app.asar"

# 3. 图标与 Info.plist
cp AppIcon.icns "$STAGE/宝宝表情包.app/Contents/Resources/AppIcon.icns"
P="$STAGE/宝宝表情包.app/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleName 宝宝表情包" "$P"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName 宝宝表情包" "$P" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string 宝宝表情包" "$P"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.struy.baby-stickers" "$P"
/usr/libexec/PlistBuddy -c "Set :CFBundleIconFile AppIcon" "$P" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Add :CFBundleIconFile string AppIcon" "$P"

# 4. 安装并本机签名
rm -rf "$DEST"
mv "$STAGE/宝宝表情包.app" "$DEST"
codesign --force --deep --sign - "$DEST" 2>/dev/null || true
xattr -cr "$DEST" 2>/dev/null || true
echo "已安装到 $DEST"
