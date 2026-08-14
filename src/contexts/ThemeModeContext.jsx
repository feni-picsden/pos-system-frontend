import React, { useEffect, useMemo, useState } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import { ThemeModeContext, THEME_STORAGE_KEY } from "./themeMode";

const prefersDark = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

const buildTheme = (mode) =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: "#1976d2",
        light: "#42a5f5",
        dark: "#1565c0",
      },
      secondary: {
        main: "#dc004e",
      },
      background:
        mode === "dark"
          ? { default: "#121212", paper: "#1e1e1e" }
          : { default: "#f5f5f5", paper: "#ffffff" },
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      h4: {
        fontWeight: 600,
      },
      h6: {
        fontWeight: 600,
      },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            borderRadius: 12,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: "none",
            fontWeight: 600,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
          },
        },
      },
    },
  });

export const ThemeModeProvider = ({ children }) => {
  const [themeMode, setThemeModeState] = useState(
    () => localStorage.getItem(THEME_STORAGE_KEY) || "inherit"
  );
  const [systemDark, setSystemDark] = useState(prefersDark);

  // Follow the OS only while "system" is selected
  useEffect(() => {
    if (themeMode !== "system" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setSystemDark(e.matches);
    setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [themeMode]);

  const value = useMemo(
    () => ({
      themeMode,
      setThemeMode: (mode) => {
        localStorage.setItem(THEME_STORAGE_KEY, mode);
        setThemeModeState(mode);
      },
    }),
    [themeMode]
  );

  const resolved =
    themeMode === "dark" || (themeMode === "system" && systemDark) ? "dark" : "light";
  const theme = useMemo(() => buildTheme(resolved), [resolved]);

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
};

export default ThemeModeProvider;
