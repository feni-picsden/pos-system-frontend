// Total Profit % is a ratio of aggregates, not an average of the row ratios:
// the mean of the per-row percentages changes with the grouping dimension
// (outlet vs customer vs customer group) even though the underlying revenue,
// cost and profit are identical. Matches the backend totals in
// reportEmailService.js and the sibling markup total.
export const totalProfitPercentage = (rows = []) => {
  const revenue = rows.reduce((sum, row) => sum + (Number(row?.revenue) || 0), 0);
  const cost = rows.reduce((sum, row) => sum + (Number(row?.costOfGoods) || 0), 0);
  return revenue ? ((revenue - cost) / revenue) * 100 : 0;
};

export default totalProfitPercentage;
