import React from "react";
import { Box, Button, Dialog } from "@mui/material";

// Reference dialog frame (.question.show-frame): a square white panel with a
// 120px circle icon straddling its top edge, a bold centred title (18.72px/700)
// and flush footer buttons. Every Sales History popup is built from this.
const VARIANTS = {
  question: { bg: "#1c86f2", glyph: "?" },
  warning: { bg: "#e0393e", glyph: "!" },
};

// Footer buttons: 48px tall, square, 32px label, flex-shared width, 8px gutters.
export const dialogButtonSx = (tone = "cancel") => {
  const tones = {
    cancel: { bg: "#f8f8f8", fg: "#676b72" },
    send: { bg: "#5ebbeb", fg: "#f8f8f8" },
    primary: { bg: "#1c86f2", fg: "#f8f8f8" },
    danger: { bg: "#e0393e", fg: "#f8f8f8" },
  };
  const { bg, fg } = tones[tone] || tones.cancel;
  return {
    flex: 1,
    height: 48,
    m: "8px 8px 0",
    p: "4px 8px",
    borderRadius: 0,
    fontSize: 32,
    fontWeight: 400,
    lineHeight: 1,
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
  title,
  width = 303,
  children,
  actions,
}) => {
  const { bg, glyph } = VARIANTS[variant] || VARIANTS.question;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{
        elevation: 0,
        sx: {
          position: "relative",
          overflow: "visible",
          borderRadius: 0,
          width,
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
        {glyph}
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

      <Box sx={{ p: "0 16px 16px", textAlign: "center" }}>{children}</Box>

      {actions && <Box sx={{ display: "flex", p: "0 8px 16px" }}>{actions}</Box>}
    </Dialog>
  );
};

export const DialogButton = ({ tone, sx, ...props }) => (
  <Button disableElevation sx={{ ...dialogButtonSx(tone), ...sx }} {...props} />
);

export default ShopfrontDialog;
