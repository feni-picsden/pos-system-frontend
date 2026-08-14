import { createContext, useContext } from "react";

export const THEME_STORAGE_KEY = "appTheme";

// Reference offers Inherit / Light / Dark / System.
// ponytail: "inherit" has no parent setting to inherit from yet, so it resolves
// to the app default (light); point it at the outlet/company setting when one exists.
export const THEME_MODES = [
  { value: "inherit", label: "Inherit" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export const ThemeModeContext = createContext({
  themeMode: "inherit",
  setThemeMode: () => {},
});

export const useThemeMode = () => useContext(ThemeModeContext);
