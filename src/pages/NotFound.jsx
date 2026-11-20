import React from "react";
import { Box, Button, Typography } from "@mui/material";
import { useLocation, Link as RouterLink } from "react-router-dom";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import { byMode } from "../theme/sfPalette";

const NotFound = () => {
  const location = useLocation();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 1.5,
        py: 10,
      }}
    >
      <SearchOffOutlinedIcon sx={{ fontSize: 64, color: byMode("#676b72", "#a0a4aa") }} />
      <Typography sx={{ fontSize: 28, fontWeight: 700, color: byMode("#313439", "#f8f8f8") }}>
        404 — Page not found
      </Typography>
      <Typography sx={{ fontSize: 16, color: byMode("#676b72", "#a0a4aa") }}>
        {location.pathname} does not exist.
      </Typography>
      <Button
        variant="contained"
        component={RouterLink} to={"/"}
        sx={{
          mt: 2,
          textTransform: "none",
          fontWeight: 700,
          backgroundColor: "#5ebbeb",
          color: byMode(undefined, "#232323"),
          "&:hover": { backgroundColor: "#4aa9dd" },
        }}
      >
        Back to Sell
      </Button>
    </Box>
  );
};

export default NotFound;
