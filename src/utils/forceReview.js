// Setup > General > Outlets > Orders & Invoices "Force Review ..." toggles: the
// backend answers 409 REVIEW_REQUIRED when a send/receive needs a review first.
// reviewCreated:true  -> the default reviewers were added, open the review page.
// reviewCreated:false -> no default reviewers configured: the order page opens
//                        its "Create Review" picker so the user chooses them.
export const reviewRequiredFrom = (err) => {
  const data = err?.response?.data;
  return err?.response?.status === 409 && data?.code === 'REVIEW_REQUIRED' ? data : null;
};

// Where to send the user for a REVIEW_REQUIRED answer about order `orderId`.
export const reviewRequiredPath = (data, orderId) =>
  data?.reviewCreated
    ? `/orders-invoices/${data.orderId || orderId}/review`
    : `/orders-invoices/${data?.orderId || orderId}?createReview=1`;
