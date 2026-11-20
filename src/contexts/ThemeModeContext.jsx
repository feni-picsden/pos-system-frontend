import React, { useEffect, useMemo, useState } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import { ThemeModeContext, THEME_STORAGE_KEY } from "./themeMode";
import { sfTokens } from "../theme/sfPalette";

const prefersDark = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

const buildTheme = (mode) => {
  const sf = sfTokens(mode);
  const dark = mode === "dark";
  return createTheme({
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
      background: { default: sf.page, paper: sf.paper },
      text: dark
        ? { primary: sf.text, secondary: sf.textMuted }
        : { primary: "rgba(0, 0, 0, 0.87)", secondary: "rgba(0, 0, 0, 0.6)" },
      divider: dark ? sf.borderLight : "rgba(0, 0, 0, 0.12)",
      // Semantic Crinit Shop tokens: sx={{ bgcolor: 'sf.pane', color: 'sf.text' }}
      sf,
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
      // Number fields are typed into, never nudged: the browser's spinner arrows
      // are a mis-click away from silently changing a price or a stock count, and
      // they crowd the ~53 screens that use type="number". Hidden app-wide here so
      // no screen has to remember to do it. The keyboard's up/down arrows still
      // work — only the painted control goes.
      MuiCssBaseline: {
        styleOverrides: {
          'input[type=number]::-webkit-outer-spin-button, input[type=number]::-webkit-inner-spin-button':
            { WebkitAppearance: 'none', margin: 0 },
          // Firefox draws its own; both engines need telling.
          'input[type=number]': { MozAppearance: 'textfield', appearance: 'textfield' },
          // Native controls (checkbox, range, date picker chrome) follow the mode.
          ':root': { colorScheme: mode },
        },
      },
      // Initials avatars: MUI paints the letters in the page background colour,
      // which is near-black in dark mode (dark "SA" on the blue navbar avatar).
      ...(dark ? { MuiAvatar: { styleOverrides: { colorDefault: { color: '#fff' } } } } : {}),
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: dark ? "0 2px 8px rgba(0,0,0,0.5)" : "0 2px 8px rgba(0,0,0,0.1)",
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
      // Every toast (success / error message) shows at the top centre, app-wide.
      MuiSnackbar: {
        defaultProps: {
          anchorOrigin: { vertical: "top", horizontal: "center" },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
          },
        },
      },
      // Dark-only base so MUI surfaces read in dark mode (light mode: MUI defaults, unchanged).
      ...(dark && {
        MuiPaper: {
          styleOverrides: {
            root: { backgroundImage: "none" },
          },
        },
        MuiTableCell: {
          styleOverrides: {
            root: { borderBottomColor: sf.borderLight },
          },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            notchedOutline: { borderColor: sf.border },
          },
        },
        MuiTooltip: {
          styleOverrides: {
            tooltip: { backgroundColor: sf.paneAlt, color: sf.text },
            arrow: { color: sf.paneAlt },
          },
        },
      }),
    },
  });
};

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

  // html[data-theme] drives the plain-CSS tokens in index.css (--sf-*) and lets
  // non-MUI markup (recharts, raw <table>, portals) follow the mode too.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
    return () => document.documentElement.removeAttribute("data-theme");
  }, [resolved]);

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
