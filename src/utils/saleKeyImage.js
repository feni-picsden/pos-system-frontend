import posLocalDb from '../services/posLocalDb';

// The product's artwork, whichever shape the product record carries.
export const productImageUrl = (product) =>
  product?.imageUrl
  || (typeof product?.mainImage === 'string' ? product.mainImage : product?.mainImage?.imageUrl)
  || product?.images?.find?.((i) => i?.isMain)?.imageUrl
  || product?.images?.[0]?.imageUrl
  || null;

// The artwork a key shows: its own image, else - when "Use Product Image" asks
// for it - the linked product's. `product` is the resolved product when the
// caller has one; otherwise the sell-screen catalogue cache is consulted.
export const resolveSaleKeyImage = (saleKey, product = null) => {
  if (saleKey.image) return saleKey.image;
  const mode = saleKey.useProductImage;
  if (mode !== 'If Available' && mode !== 'Always') return null;
  const id = saleKey.productId || saleKey.selectedProduct?.id;
  const resolved = product
    || (id && posLocalDb.isReady() ? posLocalDb.getProductById(id) : null)
    || saleKey.selectedProduct;
  return productImageUrl(resolved);
};
