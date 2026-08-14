import React from 'react';
import { Box } from '@mui/material';
// Reference uses fa-award: a rosette medal with two ribbon tails, not a trophy cup.
import { LocalOfferOutlined, WorkspacePremiumOutlined } from '@mui/icons-material';
import { Link } from 'react-router-dom';

// Reference hub: no heading, two fixed 400x250 tiles, vertically centred, no hover effect.
const TicketCard = ({ to, icon, title, description }) => (
  <Box component={Link} to={to} sx={{ textDecoration: 'none' }}>
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        width: 400,
        maxWidth: '100%',
        height: 250,
        p: 2,
        bgcolor: '#fff',
        border: '1px solid #000',
        borderRadius: 0,
        boxShadow: '0 0 30px rgba(0,0,0,0.25), 0 15px 30px rgba(0,0,0,0.19)',
        color: '#313439',
        transition: 'color 0.2s ease',
      }}
    >
      {icon}
      <Box sx={{ fontSize: 32, fontWeight: 400, mb: 2 }}>{title}</Box>
      <Box sx={{ fontSize: 16, fontWeight: 400 }}>{description}</Box>
    </Box>
  </Box>
);

const ICON_SX = { fontSize: 48, mb: 1 };

const ShelfTickets = () => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 460px))',
      justifyItems: 'center',
      alignItems: 'center',
      gap: 2,
      p: 2,
      minHeight: 'calc(100vh - 78px)',
    }}
  >
    <TicketCard
      to="/marketing/shelf-tickets/everyday"
      icon={<LocalOfferOutlined sx={ICON_SX} />}
      title="Everyday Tickets"
      description="Print your everyday price tickets for products"
    />
    <TicketCard
      to="/marketing/shelf-tickets/promotional"
      icon={<WorkspacePremiumOutlined sx={ICON_SX} />}
      title="Promotional Tickets"
      description="Print your promotional tickets"
    />
  </Box>
);

export default ShelfTickets;
