import path from "node:path";
import { app } from "electron";

const DEFAULT_ICON = "icon-01";

/** Directory containing the 9 app icon PNGs */
export function getIconsDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "icons");
  }
  // Dev mode: compiled JS lives in dist/main/main/, project root is 3 levels up
  return path.join(__dirname, "..", "..", "..", "resources");
}

/** Set the macOS dock icon to a specific icon variant */
export function applyDockIcon(iconId?: string): void {
  const resolvedId = iconId || DEFAULT_ICON;
  const iconPath = path.join(getIconsDir(), `${resolvedId}.png`);
  app.dock?.setIcon(iconPath);
}
