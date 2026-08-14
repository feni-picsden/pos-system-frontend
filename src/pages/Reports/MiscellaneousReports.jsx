import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Card, CardActionArea, Typography } from '@mui/material';
import {
  WarehouseOutlined as InventoryIcon,
  TimerOutlined as SlowMovingIcon,
  QrCodeScannerOutlined as StocktakedIcon,
  HistoryOutlined as RevisionHistoryIcon,
  AssessmentOutlined as MovementIcon,
  MonetizationOnOutlined as MetcashIcon,
} from '@mui/icons-material';

// ponytail: route paths kept as existing (/reports/...) — changing them breaks navigation.
const reports = [
  {
    id: 'inventory-at-date',
    path: '/reports/inventory-at-date',
    title: 'Inventory at Date',
    description: 'View the inventory for the store at a previous date',
    icon: InventoryIcon,
  },
  {
    id: 'slow-moving-stock',
    path: '/reports/slow-moving-stock',
    title: 'Slow Moving Stock',
    description: 'Find products that aren\'t selling',
    icon: SlowMovingIcon,
  },
  {
    id: 'stocktaked-products',
    path: '/reports/stocktaked-products',
    title: 'Stocktaked Products',
    description: 'View the most recent time a product has been stocktaked',
    icon: StocktakedIcon,
  },
  {
    id: 'product-revision-history',
    path: '/reports/product-revision-history',
    title: 'Product Revision History',
    description: 'View the history for all products in Shopfront',
    icon: RevisionHistoryIcon,
  },
  {
    id: 'inventory-movement',
    path: '/reports/inventory-movement',
    title: 'Inventory Movement',
    description: 'Track how all inventory has been adjusted over a specified period of time',
    icon: MovementIcon,
  },
  {
    id: 'metcash-msc-sales',
    path: '/reports/metcash-msc-sales',
    title: 'Metcash MSC Sales',
    description: 'Run a sales report grouped by Metcash\'s classifications',
    icon: MetcashIcon,
  },
];

const SLATE = 'rgb(49,52,57)';

const MiscellaneousReports = () => (
  <Box
    sx={{
      minHeight: 'calc(100vh - 50px)',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, 460px)',
      gap: 2,
      p: 2,
      placeContent: 'center',
      justifyItems: 'center',
    }}
  >
    {reports.map((report) => {
      const Icon = report.icon;
      return (
        <Card
          key={report.id}
          elevation={0}
          sx={{
            position: 'relative',
            overflow: 'hidden',
            height: 250,
            width: 400,
            maxWidth: '100%',
            border: '1px solid #000',
            borderRadius: 0,
            color: SLATE,
            backgroundColor: '#fff',
            boxShadow: '0 0 30px rgba(0,0,0,.25), 0 15px 30px rgba(0,0,0,.19)',
            userSelect: 'none',
            transition: 'color .2s',
            // ponytail: reference wipes a blue pseudo-element in from the left, not a bg fade.
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              backgroundColor: '#5ebbeb',
              transform: 'scaleX(0)',
              transformOrigin: '0 center',
              transition: 'transform .2s',
            },
            '&:hover': { color: '#f8f8f8' },
            '&:hover::before': { transform: 'scaleX(1)' },
          }}
        >
          <CardActionArea
            component={RouterLink}
            to={report.path}
            disableRipple
            sx={{
              position: 'relative',
              zIndex: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              p: 2,
              color: 'inherit',
              userSelect: 'none',
              // ponytail: MUI's hover overlay would tint the reference's blue wipe.
              '& .MuiCardActionArea-focusHighlight': { display: 'none' },
            }}
          >
            <Icon sx={{ fontSize: 48, width: 60, color: 'inherit', mb: 1 }} />
            <Typography
              component="h2"
              sx={{
                fontSize: 32,
                fontWeight: 400,
                lineHeight: 'normal',
                mb: 2,
                color: 'inherit',
              }}
            >
              {report.title}
            </Typography>
            <Typography sx={{ fontSize: 16, lineHeight: 'normal', color: 'inherit' }}>
              {report.description}
            </Typography>
          </CardActionArea>
        </Card>
      );
    })}
  </Box>
);

export default MiscellaneousReports;
