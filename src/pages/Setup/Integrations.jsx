import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Grid,
} from '@mui/material';
import {
  Extension as ExtensionIcon,
  Settings as SettingsIcon,
  LinkOff as RevokeIcon,
} from '@mui/icons-material';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';

// Placeholder integration data – replace with your API/data later
const SAMPLE_INTEGRATIONS = [
  {
    id: 'accounts-flow',
    name: 'Accounts Flow',
    description: 'Receive invoices electronically from thousands of suppliers.',
    developedBy: 'Shopfront',
    badge: 'official',
    isActive: false,
    logoPlaceholder: 'AF',
  },
  {
    id: 'australian-liquor-marketers',
    name: 'Australian Liquor Marketers',
    description: 'Receive invoices electronically from ALM and send orders to their web portal.',
    developedBy: 'Shopfront',
    badge: 'official',
    isActive: true,
    logoPlaceholder: 'ALM',
  },
  {
    id: 'conversion-service',
    name: 'Conversion Service',
    description: 'Have a previous point of sale system other than Shopfront? Contact us to convert your data.',
    developedBy: 'Shopfront',
    badge: 'official',
    isActive: true,
    logoPlaceholder: 'CS',
  },
  {
    id: 'iba-ecommerce',
    name: 'IBA E-Commerce',
    description: "Update your product file and receive sales from the IBA E-Commerce Platform (previously Shop MyLocal).",
    developedBy: 'Shopfront',
    badge: 'official',
    isActive: true,
    logoPlaceholder: 'IBA',
  },
  {
    id: 'iba-rewards',
    name: 'IBA Rewards',
    description: "Connect with IBA's Top Drop Rewards & My Bottle-O programs allowing your customers to access unique promotions.",
    developedBy: 'Shopfront',
    badge: 'official',
    isActive: true,
    logoPlaceholder: 'IBA',
  },
  {
    id: 'iba-scan-data',
    name: 'IBA Scan Data v2.5',
    description: 'Automatically send sales (scan) data to Independent Brands Australia in real-time.',
    developedBy: 'Shopfront',
    badge: 'official',
    isActive: true,
    logoPlaceholder: 'IBA',
  },
  {
    id: 'independent-brands',
    name: 'Independent Brands Australia',
    description: 'Send sales (scan) data to Independent Brands Australia.',
    developedBy: 'Shopfront',
    badge: 'official',
    isActive: true,
    logoPlaceholder: 'IBA',
  },
  {
    id: 'independent-liquor-group',
    name: 'Independent Liquor Group',
    description: 'Download invoices directly from ILG.',
    developedBy: 'Shopfront',
    badge: 'official',
    isActive: false,
    logoPlaceholder: 'ILG',
  },
  {
    id: 'last-yard',
    name: 'Last Yard',
    description: 'Connect your site to the Last Yard platform.',
    developedBy: 'Shopfront',
    badge: 'official',
    isActive: false,
    logoPlaceholder: 'LY',
  },
  {
    id: 'liquor-marketing-group',
    name: 'Liquor Marketing Group',
    description: "Automatically upload your product file to LMG's eCommerce store for selling online and matching scan data.",
    developedBy: 'Shopfront',
    badge: 'official',
    isActive: false,
    logoPlaceholder: 'LMG',
  },
  {
    id: 'myob',
    name: 'MYOB',
    description: 'Send your purchases and register closures directly to MYOB AccountRight.',
    developedBy: 'Shopfront',
    badge: 'official',
    isActive: false,
    logoPlaceholder: 'MYOB',
  },
  {
    id: 'ontap-data',
    name: 'OnTap Data',
    description: 'Send sales (scan) data to OnTap Data.',
    developedBy: 'Shopfront',
    badge: 'official',
    isActive: false,
    logoPlaceholder: 'OT',
  },
  {
    id: 'elabels',
    name: 'Elabels',
    description: 'Elabels Pty Ltd is an Australian owned company that sells, distributes, and installs Electronic Shelf Labels (ESLs) and associated software.',
    developedBy: null,
    badge: 'approved',
    isActive: false,
    logoPlaceholder: 'E',
  },
  {
    id: 'hanshow',
    name: 'Hanshow Integration',
    description: 'Converts product and promotion data from Shopfront into a format compatible with Hanshow electronic shelf labels.',
    developedBy: null,
    badge: 'approved',
    isActive: false,
    logoPlaceholder: 'H',
  },
  // From reference images – add your logos/images later
  {
    id: 'ilr-esl',
    name: 'ILR ESL',
    description: 'ILR ESL enables real-time electronic shelf label updates from Shopfront POS to labels.',
    developedBy: 'Anthony Newman',
    badge: 'approved',
    isActive: false,
    logoPlaceholder: 'ILR',
  },
  {
    id: 'myfoodlink',
    name: 'Myfoodlink',
    description: 'Automatically send product data to a Myfoodlink online store',
    developedBy: 'Myfoodlink Pty',
    badge: 'approved',
    isActive: false,
    logoPlaceholder: 'MFL',
  },
  {
    id: 'pricer-esl',
    name: 'Pricer ESL',
    description: 'Import pricing and product data from Shopfront to your Pricer ESL system',
    developedBy: 'Pricer-Shopfront-Integration',
    badge: 'approved',
    isActive: false,
    logoPlaceholder: 'OZESL',
  },
  {
    id: 'ticket-it',
    name: 'Ticket-IT',
    description: 'The complexity of point of sale ticketing processes can be simplified quickly and easily with Ticket-IT.',
    developedBy: 'Sam Coughlin',
    badge: 'approved',
    isActive: false,
    logoPlaceholder: 'IT',
  },
  {
    id: 'tipplegogo-store-sync',
    name: 'TippleGO - Store Sync',
    description: 'Sync your inventory updates with TippleGO for accurate stock levels.',
    developedBy: 'Tipple',
    badge: 'approved',
    isActive: false,
    logoPlaceholder: 'TG',
  },
];

function IntegrationCard({ integration, onIntegrate, onSettings, onRevoke }) {
  const { name, description, developedBy, badge, isActive, logoPlaceholder } = integration;

  const ribbonColor = badge === 'official' ? '#42a5f5' : '#FF7043';

  return (
    <Card
      sx={{
        height: '100%',
        minHeight: 350,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'visible',
        bgcolor: '#FFFFFF',
        border: '1px solid #E0E0E0',
        borderRadius: '8px',
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Diagonal ribbon badge – same style as reference */}
      {badge && (
        <>
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 0,
              height: 0,
              borderStyle: 'solid',
              borderWidth: '0 52px 52px 0',
              borderColor: `transparent ${ribbonColor} transparent transparent`,
              zIndex: 1,
            }}
          />
          <Typography
            component="span"
            sx={{
              position: 'absolute',
              top: 10,
              right: -24,
              transform: 'rotate(45deg)',
              color: 'white',
              fontSize: '0.7rem',
              fontWeight: 700,
              zIndex: 2,
              letterSpacing: 0.3,
            }}
          >
            {badge === 'official' ? 'Official Integration' : 'Approved by Shopfront'}
          </Typography>
        </>
      )}

      <CardContent
        sx={{
          flexGrow: 1,
          pt: 3,
          pb: 1,
          px: 2.5,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Logo placeholder – centered; replace with image when you have assets */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 64,
            mb: 1.5,
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 1,
              bgcolor: 'action.hover',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="body2" fontWeight={700} color="text.secondary">
              {logoPlaceholder}
            </Typography>
          </Box>
        </Box>

        <Typography
          component="h2"
          gutterBottom
          sx={{
            fontSize: '18px',
            fontWeight: 700,
            color: '#333333',
            lineHeight: 1.3,
          }}
        >
          {name}
        </Typography>
        <Typography
          sx={{
            fontSize: '14px',
            color: '#666666',
            lineHeight: 1.5,
            mb: 1.5,
            maxWidth: 240,
          }}
        >
          {description}
        </Typography>
        {developedBy && (
          <Typography
            sx={{
              fontSize: '14px',
              color: '#999999',
              display: 'block',
            }}
          >
            Developed By: {developedBy}
          </Typography>
        )}
      </CardContent>

      <CardActions
        sx={{
          px: 2,
          pb: 2,
          pt: 0,
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        {isActive ? (
          <>
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<SettingsIcon fontSize="small" />}
              onClick={() => onSettings?.(integration)}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '5px', py: 1, px: 2 }}
            >
              Settings
            </Button>
            <Button
              variant="contained"
              color="error"
              size="small"
              startIcon={<RevokeIcon fontSize="small" />}
              onClick={() => onRevoke?.(integration)}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '5px', py: 1, px: 2 }}
            >
              Revoke
            </Button>
          </>
        ) : (
          <Button
            variant="contained"
            size="medium"
            startIcon={<ExtensionIcon fontSize="small" />}
            onClick={() => onIntegrate?.(integration)}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '5px',
              py: 1.25,
              px: 2.5,
              bgcolor: '#56B4EF',
              color: '#FFFFFF',
              '&:hover': { bgcolor: '#42a5f5' },
            }}
          >
            Integrate
          </Button>
        )}
      </CardActions>
    </Card>
  );
}

const Integrations = () => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { confirm } = useAppDialogs();
  const [integrations] = useState(SAMPLE_INTEGRATIONS);

  const handleConfigureWebhooks = () => {
    // Placeholder – wire to your webhooks config page/modal later
    console.log('Configure Webhooks');
  };

  const handleIntegrate = (integration) => {
    console.log('Integrate', integration.name);
  };

  const handleSettings = (integration) => {
    console.log('Settings', integration.name);
  };

  const handleRevoke = async (integration) => {
    if (await confirm(`Revoke the integration with ${integration.name}?`, { title: 'Revoke integration', confirmText: 'Revoke' })) {
      console.log('Revoke', integration.name);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
          mb: 3,
        }}
      >
        <Typography variant="h4" fontWeight={600}>
          Integrations
        </Typography>
        <Button
          variant="contained"
          onClick={handleConfigureWebhooks}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            bgcolor: '#42a5f5',
            '&:hover': { bgcolor: '#1976d2' },
          }}
        >
          Configure Webhooks
        </Button>
      </Box>

      <Grid container spacing={2}>
        {integrations.map((integration) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={integration.id}>
            <IntegrationCard
              integration={integration}
              onIntegrate={handleIntegrate}
              onSettings={handleSettings}
              onRevoke={handleRevoke}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Integrations;
