export const saleKeyGeometry = (key) => ({
  position: { ...key.position, x: key.position?.x || 0, y: key.position?.y || 0 },
  size: { width: key.size?.width || key.position?.w || 1, height: key.size?.height || key.position?.h || 1 },
});

export const pointerCellDelta = (point, start, bounds, grid) => ({
  x: Math.round((point.clientX - start.startX) / (bounds.width / grid.cols)),
  y: Math.round((point.clientY - start.startY) / (bounds.height / grid.rows)),
});

export const canPlaceSaleKey = (key, keys, grid) => {
  const { position: p, size: s } = saleKeyGeometry(key);
  if (p.x < 0 || p.y < 0 || p.x + s.width > grid.cols || p.y + s.height > grid.rows) return false;
  return !keys.some(other => {
    if (!other?.position || other.id === key.id) return false;
    const { position: q, size: t } = saleKeyGeometry(other);
    return p.x < q.x + t.width && p.x + s.width > q.x && p.y < q.y + t.height && p.y + s.height > q.y;
  });
};

export const moveSaleKey = (key, delta, grid) => {
  const { position, size } = saleKeyGeometry(key);
  const x = Math.max(0, Math.min(grid.cols - size.width, position.x + delta.x));
  const y = Math.max(0, Math.min(grid.rows - size.height, position.y + delta.y));
  return { ...key, size, position: { ...position, x, y, w: size.width, h: size.height } };
};
