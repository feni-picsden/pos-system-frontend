import React from "react";
import { Box, Button, Typography } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";

const NotFound = () => {
  const navigate = useNavigate();
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
      <SearchOffOutlinedIcon sx={{ fontSize: 64, color: "#676b72" }} />
      <Typography sx={{ fontSize: 28, fontWeight: 700, color: "#313439" }}>
        404 — Page not found
      </Typography>
      <Typography sx={{ fontSize: 16, color: "#676b72" }}>
        {location.pathname} does not exist.
      </Typography>
      <Button
        variant="contained"
        onClick={() => navigate("/")}
        sx={{
          mt: 2,
          textTransform: "none",
          fontWeight: 700,
          backgroundColor: "#5ebbeb",
          "&:hover": { backgroundColor: "#4aa9dd" },
        }}
      >
        Back to Sell
      </Button>
    </Box>
  );
};

export default NotFound;
