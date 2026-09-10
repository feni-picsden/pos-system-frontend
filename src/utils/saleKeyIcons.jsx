import React from 'react';
import {
  Add as AddIcon,
  ArrowUpward as ArrowUpIcon,
  AttachMoney as MoneyIcon,
  Cancel as CancelIcon,
  CreditCard as CreditCardIcon,
  EmojiEvents as PartyIcon,
  Folder as FolderIcon,
  InfoOutlined as InfoOutlinedIcon,
  LocalBar as BarIcon,
  LocalDrink as DrinkIcon,
  LocalOffer as OfferIcon,
  Person as PersonIcon,
  Remove as RemoveIcon,
  ShoppingCart as CartIcon,
} from '@mui/icons-material';

/**
 * The icon that stands for a key's action when the key carries no artwork.
 *
 * This used to live inside SaleKeyPage, so only the sale screen could reach it -
 * the two designer grids fell back to their own emoji ("📦", "💳", "🛒"). The
 * same key therefore showed a box emoji while you were designing it and a real
 * icon once it went live, which made the designer a poor preview of the thing
 * being designed. One list, used by every grid, keeps them identical.
 *
 * Returns null for a payment key that has an amount: those lead with the amount
 * itself, so an icon beside it would just repeat what the tile already says.
 */
export const getIconForSaleKey = (saleKey) => {
  if ((saleKey.action === 'payment' || saleKey.action === 'pay-amount') && saleKey.amount) {
    return null;
  }

  switch (saleKey.action) {
    case 'payment':
    case 'pay-amount':
      return saleKey.paymentMethod === 'cash' ? <MoneyIcon /> : <CreditCardIcon />;
    case 'add-product':
      return saleKey.name?.toLowerCase().includes('beer') ? <BarIcon /> : <DrinkIcon />;
    case 'add-product-case':
      return <CartIcon />;
    case 'add-product-combo':
      return <OfferIcon />;
    case 'add-gift-card':
      return <OfferIcon />;
    case 'subtract-quantity':
      return <RemoveIcon />;
    case 'add-quantity':
      return <AddIcon />;
    case 'clear-sale':
      return <CancelIcon />;
    case 'cancel-current-sale':
      return <CancelIcon />;
    case 'open-drawer':
      return <MoneyIcon />;
    case 'display-product-details':
      return <InfoOutlinedIcon />;
    case 'view-live-profit':
      return <OfferIcon />;
    case 'view-promotions':
      return <OfferIcon />;
    case 'create-customer':
      return <PersonIcon />;
    case 'display-classification-products':
    case 'display-classification-products-case':
      return <FolderIcon />;
    case 'navigation':
      return <ArrowUpIcon />;
    case 'special':
      return saleKey.name?.toLowerCase().includes('party') ? <PartyIcon /> : <OfferIcon />;
    default:
      return <CartIcon />;
  }
};

export default getIconForSaleKey;
