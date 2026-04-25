module.exports = {
  appId: "com.pulse.holdings",
  productName: "Pulse",
  directories: { output: "dist-electron" },
  files: [
    ".next/**/*",
    "public/**/*",
    "world-brain/**/*",
    "electron/**/*",
    "lib/**/*",
    "pages/**/*",
    "types/**/*",
    "package.json",
    "next.config.*"
  ],
  extraResources: [
    { from: "scripts/mlx-server.sh", to: "scripts/mlx-server.sh" }
  ],
  mac: {
    target: [{ target: "dmg", arch: ["arm64", "x64"] }],
    category: "public.app-category.finance",
    icon: "public/icon.icns",
    hardenedRuntime: true,
    entitlements: "build/entitlements.mac.plist"
  },
  win: {
    target: "nsis",
    icon: "public/icon.ico"
  },
  linux: {
    target: "AppImage",
    icon: "public/icon.png"
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true
  }
};
