import React, { useState, useEffect } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Link,
} from '@mui/material';
import {
  CheckCircleOutlined as CheckCircleIcon,
  CancelOutlined as CancelIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import promotionService from '../../services/promotionService';
import { format } from 'date-fns';
import {
  SECTION_ROOT_SX,
  GRID_TABLE_SX,
  NICE_ERROR_SX,
  NICE_ERROR_ICON_SX,
  NICE_ERROR_REASON_SX,
  NICE_ERROR_HEADING_SX,
  NICE_ERROR_BODY_SX,
} from './productViewStyles';

const ProductPromotions = ({ productId }) => {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (productId) {
      loadPromotions();
    }
  }, [productId]);

  const loadPromotions = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await promotionService.getPromotions({ limit: 1000 });

      let allPromotions = [];
      if (Array.isArray(response)) {
        allPromotions = response;
      } else if (response.promotions && Array.isArray(response.promotions)) {
        allPromotions = response.promotions;
      } else if (response.data && Array.isArray(response.data)) {
        allPromotions = response.data;
      } else if (
        response.data &&
        response.data.promotions &&
        Array.isArray(response.data.promotions)
      ) {
        allPromotions = response.data.promotions;
      }

      // Filter promotions that include this product
      const productPromotions = allPromotions.filter((promotion) => {
        if (!promotion.items || !Array.isArray(promotion.items)) return false;
        return promotion.items.some((item) => {
          const itemProductId = item.productId || item.product?.id;
          return itemProductId && parseInt(itemProductId) === parseInt(productId);
        });
      });

      // Sort by start date (most recent first)
      productPromotions.sort((a, b) => {
        const dateA = a.startDate ? new Date(a.startDate) : new Date(0);
        const dateB = b.startDate ? new Date(b.startDate) : new Date(0);
        return dateB - dateA;
      });

      setPromotions(productPromotions);
    } catch (err) {
      console.error('Error loading promotions:', err);
      setError('Failed to load promotions');
    } finally {
      setLoading(false);
    }
  };

  const isPromotionActive = (promotion) => {
    if (!promotion) return false;
    if (promotion.isActive === false || promotion.isActive === 0) return false;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (promotion.startDate) {
      const startDate = new Date(promotion.startDate);
      const startDateOnly = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate()
      );
      if (today < startDateOnly) return false;
    }

    if (promotion.endDate) {
      const endDate = new Date(promotion.endDate);
      const endDateOnly = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate()
      );
      if (today > endDateOnly) return false;
    }

    return true;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy');
    } catch {
      return 'Invalid Date';
    }
  };

  const handlePromotionClick = (promotion) => {
    const expressTypes = ['Price Override', 'Discount Percentage', 'Discount Amount'];
    if (expressTypes.includes(promotion.promotionType)) {
      navigate(`/marketing/promotions/express/${promotion.id}/view`);
    } else {
      navigate(`/marketing/promotions/${promotion.id}`);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          ...SECTION_ROOT_SX,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 200,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={SECTION_ROOT_SX}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={SECTION_ROOT_SX}>
      {promotions.length === 0 ? (
        <Box sx={NICE_ERROR_SX}>
          <Box sx={NICE_ERROR_ICON_SX}>&#8709;</Box>
          <Box sx={NICE_ERROR_REASON_SX}>
            <Box component="h2" sx={NICE_ERROR_HEADING_SX}>
              No promotions found
            </Box>
            <Box component="p" sx={NICE_ERROR_BODY_SX}>
              We couldn&apos;t find any promotions this product is on
            </Box>
          </Box>
        </Box>
      ) : (
        <Table sx={GRID_TABLE_SX}>
          <TableHead>
            <TableRow>
              <TableCell>Promotion</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>Start</TableCell>
              <TableCell>End</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {promotions.map((promotion) => {
              const isActive = isPromotionActive(promotion);
              return (
                <TableRow key={promotion.id}>
                  <TableCell>
                    <Link
                      component="button"
                      onClick={() => handlePromotionClick(promotion)}
                      sx={{
                        color: '#32b643',
                        fontSize: 16,
                        textDecoration: 'none',
                        cursor: 'pointer',
                        transition: 'color 0.2s ease',
                        '&:hover': {
                          color: 'rgb(109, 215, 123)',
                          textDecoration: 'underline',
                        },
                      }}
                    >
                      {promotion.name || 'Unnamed Promotion'}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {isActive ? (
                      <CheckCircleIcon sx={{ color: '#32b643', display: 'block' }} />
                    ) : (
                      <CancelIcon sx={{ color: '#e3342f', display: 'block' }} />
                    )}
                  </TableCell>
                  <TableCell>{formatDate(promotion.startDate)}</TableCell>
                  <TableCell>{formatDate(promotion.endDate)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Box>
  );
};

export default ProductPromotions;
