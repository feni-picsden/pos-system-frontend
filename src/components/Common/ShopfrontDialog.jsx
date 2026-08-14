import React from "react";
import { Box, Button, Dialog } from "@mui/material";

// Reference dialog frame (.question.show-frame): a square white panel with a
// 120px circle icon straddling its top edge, a bold centred title (18.72px/700)
// and flush footer buttons.
//
// Two call styles are supported, because both exist in the app:
//   1. descriptor style — <ShopfrontDialog icon message actions={[{label,onClick,
//      variant:'secondary',disabled,busy}]} /> (register takeover / location
//      selector dialogs)
//   2. composed style — <ShopfrontDialog title actions={<DialogButton .../>}>
//      {body}</ShopfrontDialog> (Sales History popups)
// Passing an ARRAY to `actions` picks style 1; a node picks style 2. Rendering a
// descriptor array as a child is React error #31.
const VARIANTS = {
  question: { bg: "#1c86f2", glyph: "?" },
  warning: { bg: "#e0393e", glyph: "!" },
};

// Footer buttons: square, flex-shared width, 8px gutters. The composed style
// uses the reference's 48px/32px chrome; descriptor dialogs carry sentence-length
// labels ("Take Back Control"), so they get a 16px label instead.
export const dialogButtonSx = (tone = "cancel", compact = false) => {
  const tones = {
    cancel: { bg: "#f8f8f8", fg: "#676b72" },
    send: { bg: "#5ebbeb", fg: "#f8f8f8" },
    primary: { bg: "#1c86f2", fg: "#f8f8f8" },
    danger: { bg: "#e0393e", fg: "#f8f8f8" },
  };
  const { bg, fg } = tones[tone] || tones.cancel;
  return {
    flex: 1,
    minHeight: 48,
    m: "8px 8px 0",
    p: "4px 8px",
    borderRadius: 0,
    fontSize: compact ? 16 : 32,
    fontWeight: 400,
    lineHeight: 1.2,
    textTransform: "none",
    boxShadow: "none",
    bgcolor: bg,
    color: fg,
    border: `1px solid ${tone === "cancel" ? "#676b72" : "#f8f8f8"}`,
    "&:hover": { boxShadow: "none", bgcolor: bg, filter: "brightness(0.94)" },
    "&.Mui-disabled": { bgcolor: bg, color: fg, opacity: 0.45 },
  };
};

const ShopfrontDialog = ({
  open,
  onClose,
  variant = "question",
  icon,
  title,
  message,
  width,
  zIndex,
  dim = true,
  children,
  actions,
}) => {
  const { bg, glyph } = VARIANTS[variant] || VARIANTS.question;
  const descriptors = Array.isArray(actions) ? actions : null;
  const panelWidth = width || (descriptors || message ? 420 : 303);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      sx={zIndex ? { zIndex } : undefined}
      slotProps={dim ? undefined : { backdrop: { sx: { backgroundColor: "transparent" } } }}
      PaperProps={{
        elevation: 0,
        sx: {
          position: "relative",
          overflow: "visible",
          borderRadius: 0,
          width: panelWidth,
          maxWidth: "92vw",
          m: 0,
          boxShadow: "0 0 30px rgba(0,0,0,.25),0 15px 30px rgba(0,0,0,.2)",
        },
      }}
    >
      {/* The circle sits half outside the panel, exactly like the reference. */}
      <Box
        sx={{
          position: "absolute",
          top: -60,
          left: "50%",
          transform: "translateX(-50%)",
          width: 120,
          height: 120,
          borderRadius: "50%",
          bgcolor: bg,
          color: "#fff",
          fontSize: 72,
          fontWeight: 300,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon || glyph}
      </Box>

      <Box
        component="h3"
        sx={{
          m: "60px 8px 8px",
          pt: "8px",
          textAlign: "center",
          fontSize: "18.72px",
          fontWeight: 700,
        }}
      >
        {title}
      </Box>

      <Box sx={{ p: "0 16px 16px", textAlign: "center" }}>
        {message && <Box sx={{ fontSize: 16, m: "16px 0" }}>{message}</Box>}
        {children}
      </Box>

      {descriptors ? (
        <Box sx={{ display: "flex", p: "0 8px 16px" }}>
          {descriptors.map((action) => (
            <Button
              key={action.label}
              disableElevation
              onClick={action.onClick}
              disabled={action.disabled || action.busy}
              sx={dialogButtonSx(action.variant === "secondary" ? "cancel" : "primary", true)}
            >
              {action.busy ? "Please wait..." : action.label}
            </Button>
          ))}
        </Box>
      ) : (
        actions && <Box sx={{ display: "flex", p: "0 8px 16px" }}>{actions}</Box>
      )}
    </Dialog>
  );
};

export const DialogButton = ({ tone, sx, ...props }) => (
  <Button disableElevation sx={{ ...dialogButtonSx(tone), ...sx }} {...props} />
);

export default ShopfrontDialog;
