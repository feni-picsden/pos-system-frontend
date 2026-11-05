import React from "react";
import { Box, Typography } from "@mui/material";
import { Check as CheckIcon } from "@mui/icons-material";
import { formatRevisionValue } from "../../utils/revisionValue";
import { formatAppPattern } from "../../utils/appDateTime";

// Promotion view > Revision History cell (reference, measured 05/11/2026):
//   * "createdAt" rows print the time on the store clock ("04/11/2026 16:39:16").
//   * "criteriaAdded" / "criteriaRemoved" rows print a bordered Type | Item |
//     Included table (tick when included); the sentence sits in the other column.
//   * everything else is plain text.
const CELL_SX = {
  border: "1px solid #000",
  padding: "4px 8px",
  fontSize: 16,
  color: "#000",
};

export default function PromotionRevisionCell({ field, value }) {
  if (field === "createdAt" && value) {
    return <>{formatAppPattern(value, "DD/MM/YYYY HH:mm:ss") || formatRevisionValue(value)}</>;
  }
  if (value && typeof value === "object" && Array.isArray(value.items)) {
    return (
      <Box
        component="table"
        sx={{ borderCollapse: "collapse", "& th": { ...CELL_SX, fontWeight: 700 }, "& td": CELL_SX }}
      >
        <thead>
          <tr>
            <th>Type</th>
            <th>Item</th>
            <th>Included</th>
          </tr>
        </thead>
        <tbody>
          {value.items.map((it, i) => (
            <tr key={i}>
              <td>{it.type}</td>
              <td>{it.item}</td>
              <td style={{ textAlign: "center" }}>{it.included ? <CheckIcon sx={{ fontSize: 18 }} /> : ""}</td>
            </tr>
          ))}
        </tbody>
      </Box>
    );
  }
  return <Typography component="span" sx={{ fontSize: "inherit" }}>{formatRevisionValue(value)}</Typography>;
}

