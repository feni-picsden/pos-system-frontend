import React from "react";
import { Card, CardContent, Typography, Box } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import {
  AssignmentOutlined as StockListIcon,
  QrCodeScannerOutlined as ExternalStocktakeIcon,
  PriceCheckOutlined as CappedPricingIcon,
  EditOutlined as BulkPriceEditIcon,
  WarehouseOutlined as ImportSupplierIcon,
  RequestQuoteOutlined as BuyingPeriodsIcon,
} from "@mui/icons-material";

const stockManagementCards = [
  {
    id: "stock-list",
    title: "Stock List",
    description: "An exportable list of product's cost, inventory and prices",
    icon: StockListIcon,
    path: "/stock-management/stock-list",
  },
  {
    id: "external-stocktake",
    title: "External Stocktake",
    description:
      "Import and Export files to use with an external stocktaker or stocktaking program",
    icon: ExternalStocktakeIcon,
    path: "/stock-management/external-stocktake",
  },
  {
    id: "capped-pricing",
    title: "Capped Pricing",
    description: "Compare your prices with a list of maximum shelf prices",
    icon: CappedPricingIcon,
    path: "/stock-management/capped-pricing",
  },
  {
    id: "bulk-price-edit",
    title: "Bulk Price Edit",
    description: "Edit multiple product's prices at once",
    icon: BulkPriceEditIcon,
    path: "/stock-management/bulk-price-edit",
  },
  {
    id: "import-supplier-products",
    title: "Import Supplier Products",
    description: "Import a list of products from their supplier codes",
    icon: ImportSupplierIcon,
    path: "/stock-management/import-supplier-products",
  },
  {
    id: "product-buying-periods",
    title: "Product Buying Periods",
    description: "View and edit the buying periods for products",
    icon: BuyingPeriodsIcon,
    path: "/stock-management/product-buying-periods",
  },
];

const MoreStockManagement = () => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, 460px)",
      justifyContent: "center",
      gap: "16px",
      p: "16px",
    }}
  >
    {stockManagementCards.map((card) => {
      const Icon = card.icon;
      return (
        <Card
          key={card.id}
          component={RouterLink}
          to={card.path}
          sx={{
            width: 400,
            height: 250,
            display: "flex",
            flexDirection: "column",
            cursor: "pointer",
            position: "relative",
            overflow: "hidden",
            textDecoration: "none",
            backgroundColor: "transparent",
            border: "1px solid #000",
            borderRadius: 0,
            boxShadow:
              "0 0 30px rgba(0,0,0,0.25), 0 15px 30px rgba(0,0,0,0.19)",
            color: "#313439",
            transition: "color 0.2s ease",
            "&::before": {
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "#5ebbeb",
              transform: "scaleX(0)",
              transformOrigin: "left",
              transition: "transform 0.2s ease",
              zIndex: 0,
            },
            "&:hover": {
              color: "#f8f8f8",
              "&::before": { transform: "scaleX(1)" },
            },
          }}
        >
          <CardContent
            sx={{
              flexGrow: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              p: "16px",
              position: "relative",
              zIndex: 1,
              color: "inherit",
            }}
          >
            <Icon sx={{ fontSize: 48, color: "inherit", mb: 1 }} />
            <Typography
              component="h2"
              sx={{
                fontSize: 32,
                fontWeight: 400,
                color: "inherit",
                mb: 2,
                whiteSpace: "nowrap",
              }}
            >
              {card.title}
            </Typography>
            <Typography
              sx={{ fontSize: 16, fontWeight: 400, color: "inherit" }}
            >
              {card.description}
            </Typography>
          </CardContent>
        </Card>
      );
    })}
  </Box>
);

export default MoreStockManagement;
