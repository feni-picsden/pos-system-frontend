import React, { useState, useEffect } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import { Box, Paper, Typography, Button, Alert } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import priceListService from '../../services/priceListService';
import { formatRuleSummary } from './ruleLabels';

// Shopfront's price list VIEW page (/pricelists/{id}) is read-only: the name as the
// heading, the rule list, and the View Customers / Edit Price List actions. Every
// editable control — name, both toggles, the rules themselves — lives on the edit
// page (PriceListConfiguration.jsx), so nothing here writes.

// Reference button: flat blue, square, inverts on hover.
const refButtonSx = {
  bgcolor: '#1c86f2',
  color: '#f8f8f8',
  border: '1px solid currentColor',
  borderRadius: 0,
  boxShadow: 'none',
  fontSize: 16,
  fontWeight: 400,
  lineHeight: 1.25,
  textTransform: 'none',
  p: '.5rem',
  transition: 'background 0.2s ease, color 0.2s ease',
  '&:hover': { bgcolor: '#f8f8f8', color: '#1c86f2', boxShadow: 'none' },
};

const ruleRowSx = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 2,
  p: 2,
  mb: 2,
  border: '1px solid #e0e0e0',
  borderRadius: 0,
  boxShadow: 'none',
};

const PriceListDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [priceList, setPriceList] = useState(null);
  const [configuration, setConfiguration] = useState({ rules: [], fallbackRule: null });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [listRes, configRes] = await Promise.all([
          priceListService.getPriceList(id),
          priceListService.getPriceListConfiguration(id).catch(() => null),
        ]);
        if (cancelled) return;
        setPriceList(listRes.priceList);
        setConfiguration(configRes?.configuration || { rules: [], fallbackRule: null });
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || 'Failed to load price list');
        console.error('Error loading price list:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const rules = configuration.rules || [];
  const fallbackRule = configuration.fallbackRule;

  if (loading) {
    return <PageLoader />;
  }

  return (
    <Box sx={{ backgroundColor: '#fff', minHeight: '100vh', p: '0 1rem 1rem' }}>
      <Box
        component="h1"
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '.5rem',
          m: 0,
          py: '1rem',
          fontSize: 32,
          fontWeight: 700,
          color: '#000',
        }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/customers/price-lists')}
          disableElevation
          sx={refButtonSx}
        >
          Back
        </Button>
        <Box component="span">{priceList?.name || ''}</Box>
      </Box>

      <Box sx={{ maxWidth: 800, margin: 'auto' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', mb: '1rem' }}>
          <Button
            onClick={() => navigate(`/customers?priceList=${id}`)}
            disableElevation
            sx={refButtonSx}
          >
            View Customers
          </Button>
          <Button
            onClick={() => navigate(`/customers/price-lists/${id}/configuration`)}
            disableElevation
            sx={refButtonSx}
          >
            Edit Price List
          </Button>
        </Box>

        {rules.length === 0 && !fallbackRule && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
            <Typography variant="h6" sx={{ color: '#9e9e9e', fontWeight: 400 }}>
              This price list is empty
            </Typography>
          </Box>
        )}

        {rules.map((rule) => (
          <Paper key={rule.id} sx={ruleRowSx}>
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 500, color: '#000' }}>
                {rule.entityName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {rule.entityType
                  ? rule.entityType.charAt(0).toUpperCase() + rule.entityType.slice(1)
                  : ''}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 16, color: rule.excludeFromPriceList ? '#e33430' : '#000' }}>
              {formatRuleSummary(rule)}
            </Typography>
          </Paper>
        ))}

        {fallbackRule && (
          <Paper sx={ruleRowSx}>
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 500, color: '#000' }}>
                Fallback Rule
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Everything not matched above
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 16, color: '#000' }}>
              {formatRuleSummary(fallbackRule)}
            </Typography>
          </Paper>
        )}
      </Box>
    </Box>
  );
};

export default PriceListDetails;
