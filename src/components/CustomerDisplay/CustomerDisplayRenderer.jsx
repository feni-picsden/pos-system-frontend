import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { getMediaUrl } from '../Common/mediaCentreUi';

// Same test as the editor's: a media URL may carry a query string / hash.
const isVideoUrl = (url = '') => /\.(mp4|webm|mov|ogg)(\?|#|$)/i.test(String(url));
// Both toggles off = media keeps its own ratio inside the box (contain);
// "fill" stretches to the box; "cover" keeps the ratio and crops the overflow.
const getObjectFit = (settings = {}) => {
  if (settings.stretchToFill) return 'fill';
  if (settings.stretchToCover) return 'cover';
  return 'contain';
};

// ponytail: one placeholder is all the sale payload carries; add more tokens here if needed.
const CUSTOMER_NAME_TOKEN = /\{\{\s*customerName\s*\}\}/g;

const isSlideActive = (slide) => {
  if (!slide) return false;
  const now = Date.now();
  const start = slide.startAt ? new Date(slide.startAt).getTime() : null;
  const end = slide.endAt ? new Date(slide.endAt).getTime() : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
};

const SlideShowContent = ({ component }) => {
  const slides = useMemo(
    () => (component?.settings?.slides || []).filter((slide) => slide?.url && isSlideActive(slide)),
    [component]
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (!slides.length) return undefined;
    const activeSlide = slides[index % slides.length];
    const durationMs = Math.max(1, Number(activeSlide.seconds) || 3.5) * 1000;
    const timer = setTimeout(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, durationMs);
    return () => clearTimeout(timer);
  }, [index, slides]);

  if (!slides.length) {
    return (
      <Box sx={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(128,128,128,0.6)', boxSizing: 'border-box' }}>
        <Typography variant="body2" sx={{ color: '#9ca3af' }}>
          {component?.settings?.fallbackText || 'No slides configured'}
        </Typography>
      </Box>
    );
  }

  // Crossfade: every slide is stacked, only the active one is visible, and the
  // opacity change is animated so the swap doesn't flash.
  const activeIndex = index % slides.length;
  const objectFit = getObjectFit(component?.settings || {});
  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {slides.map((slide, i) => {
        const active = i === activeIndex;
        const layerSx = {
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit,
          opacity: active ? 1 : 0,
          transition: 'opacity 600ms ease-in-out',
          pointerEvents: 'none',
        };
        // Media URLs may be stored relative to the API ("/uploads/…"); resolve them.
        const src = getMediaUrl(slide.url);
        return isVideoUrl(slide.url) ? (
          // Only the visible video plays; hidden ones are unmounted so they don't buffer.
          active && <Box key={`${slide.url}-${i}`} component="video" src={src} autoPlay muted loop sx={layerSx} />
        ) : (
          <Box key={`${slide.url}-${i}`} component="img" src={src} alt="slide" sx={layerSx} />
        );
      })}
    </Box>
  );
};

const CustomerDisplayRenderer = ({
  template,
  mode,
  data,
  selectedComponentId,
  onSelectComponent,
  onChangeComponent,
  editable = false,
  showEditorGrid = false,
  gridCols = 10,
  gridRows = 10,
  snapToGrid = false,
}) => {
  const containerRef = useRef(null);
  const [dragState, setDragState] = useState(null);
  const components = template?.[mode]?.components || [];
  const sorted = [...components].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  const hasComponents = sorted.length > 0;
  const showEditorCanvasGrid = editable && showEditorGrid;
  const items = data?.cartItems || [];
  const totals = data?.totals || {};
  const resizeHandles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  useEffect(() => {
    if (!dragState || !editable || !onChangeComponent) return undefined;
    const onMouseMove = (event) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dxPercent = (event.clientX - dragState.startX) / rect.width * 100;
      const dyPercent = (event.clientY - dragState.startY) / rect.height * 100;

      const minSize = 6;
      const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
      const cellWidth = 100 / Math.max(1, Number(gridCols) || 10);
      const cellHeight = 100 / Math.max(1, Number(gridRows) || 10);
      const snapX = (value) => {
        if (!snapToGrid) return value;
        const step = Math.max(0.1, cellWidth);
        return Math.round(value / step) * step;
      };
      const snapY = (value) => {
        if (!snapToGrid) return value;
        const step = Math.max(0.1, cellHeight);
        return Math.round(value / step) * step;
      };

      let { x, y, w, h } = dragState.component;
      if (dragState.type === 'move') {
        const maxX = 100 - dragState.component.w;
        const maxY = 100 - dragState.component.h;
        x = clamp(snapX(dragState.component.x + dxPercent), 0, maxX);
        y = clamp(snapY(dragState.component.y + dyPercent), 0, maxY);
      } else if (dragState.type === 'resize') {
        const handle = dragState.handle;
        let nextX = dragState.component.x;
        let nextY = dragState.component.y;
        let nextW = dragState.component.w;
        let nextH = dragState.component.h;

        if (handle.includes('e')) nextW = clamp(dragState.component.w + dxPercent, minSize, 100 - dragState.component.x);
        if (handle.includes('s')) nextH = clamp(dragState.component.h + dyPercent, minSize, 100 - dragState.component.y);
        if (handle.includes('w')) {
          nextX = clamp(dragState.component.x + dxPercent, 0, dragState.component.x + dragState.component.w - minSize);
          nextW = clamp(dragState.component.w - (nextX - dragState.component.x), minSize, 100);
        }
        if (handle.includes('n')) {
          nextY = clamp(dragState.component.y + dyPercent, 0, dragState.component.y + dragState.component.h - minSize);
          nextH = clamp(dragState.component.h - (nextY - dragState.component.y), minSize, 100);
        }

        x = clamp(snapX(nextX), 0, 100 - nextW);
        y = clamp(snapY(nextY), 0, 100 - nextH);
        w = clamp(snapX(nextW), minSize, 100 - x);
        h = clamp(snapY(nextH), minSize, 100 - y);
      }

      onChangeComponent(dragState.componentId, { x, y, w, h });
    };

    const onMouseUp = () => setDragState(null);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragState, editable, onChangeComponent]);

  const renderComponent = (component) => {
    switch (component.type) {
      case 'sale-table': {
        // Same fallback as the editor: no (or empty) saved headers = the four defaults
        const headers = (component?.settings?.headers?.length ? component.settings.headers : [
          { key: 'product', label: 'Product', visible: true, align: 'Default' },
          { key: 'quantity', label: 'Quantity', visible: true, align: 'Default' },
          { key: 'price', label: 'Price', visible: true, align: 'Default' },
          { key: 'total', label: 'Total', visible: true, align: 'Default' },
        ]).filter((header) => header.visible !== false);
        // Reference: the product column is wide, the number columns narrow; every
        // cell has a grid line when "Show Grid" is on; header bold and centred
        // (product header left); a promotion line is drawn in the promotion colour.
        const columnTemplate = headers.map((header) => (header.key === 'product' ? '3.6fr' : '1fr')).join(' ');
        const alignMap = { Left: 'left', Center: 'center', Centre: 'center', Right: 'right' };
        const defaultAlign = (header) => (header.key === 'product' ? 'left' : 'center');
        const cellAlign = (header) => alignMap[header.align] || defaultAlign(header);
        const showGrid = component?.settings?.showGrid !== false;
        const gridLine = showGrid ? `1px solid ${component?.settings?.gridLineColor || '#000'}` : 'none';
        const cellSx = { border: gridLine, px: 1, py: 0.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
        return (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', color: component?.settings?.textColor || '#000', fontSize: component?.settings?.fontSize || 20 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: columnTemplate, fontWeight: 700 }}>
              {headers.map((header) => (
                <Box key={header.key} sx={{ ...cellSx, textAlign: cellAlign(header) }}>{header.label}</Box>
              ))}
            </Box>
            {items.slice(0, 8).map((item) => (
              <Box key={`${item.id}-${item.timestamp || item.name}`} sx={{ display: 'grid', gridTemplateColumns: columnTemplate, color: item.isPromotion ? (component?.settings?.promotionColor || '#2ce56f') : 'inherit' }}>
                {/* Body cells follow an explicit column alignment; "Default" is left (reference) */}
                {headers.map((header) => (
                  <Box key={header.key} sx={{ ...cellSx, textAlign: alignMap[header.align] || 'left' }}>
                    {header.key === 'product' ? item.name : header.key === 'quantity' ? (item.quantity || 1) : header.key === 'price' ? `$${Number(item.unitPrice || 0).toFixed(2)}` : `$${Number(item.totalPrice || item.price || 0).toFixed(2)}`}
                  </Box>
                ))}
              </Box>
            ))}
            {/* Reference footer: "Public Holiday Surcharge: $2.25 | 1 Item" — the surcharge
                (custom name) sits at the bottom of the sale table, before the item count. */}
            <Box sx={{ mt: 'auto', px: 1, py: 0.5, textAlign: 'right', color: component?.settings?.footerTextColor || 'inherit', bgcolor: component?.settings?.footerBackgroundColor || 'transparent' }}>
              {Object.entries(totals.surcharges || {}).filter(([, amt]) => Number(amt) > 0).map(([name, amt]) => `${name}: $${Number(amt).toFixed(2)} | `).join('')}
              {Number(totals.itemCount || 0)} {Number(totals.itemCount || 0) === 1 ? 'Item' : 'Items'}
            </Box>
          </Box>
        );
      }
      case 'totals': {
        // Same default rows as the editor; rows with no value (change/approved/thank you
        // before payment) are skipped so the box shows what the reference shows.
        const labels = component?.settings?.labels?.length
          ? component.settings.labels
          : [
              { key: 'total', label: 'Total:', visible: true },
              { key: 'savings', label: 'Savings:', visible: true },
              { key: 'change', label: 'Change:', visible: true },
              { key: 'approved', label: 'Approved', visible: true },
              { key: 'thank_you', label: 'Thank You', visible: true },
              { key: 'remaining', label: 'Remaining', visible: false },
              { key: 'paid', label: 'Paid', visible: false },
            ];
        const hasValue = (key) => {
          if (key === 'total' || key === 'savings') return true;
          if (key === 'change') return Number(totals.change || 0) > 0;
          if (key === 'approved') return Boolean(totals.approved);
          if (key === 'thank_you') return Boolean(totals.paid) && Number(totals.remaining || 0) <= 0;
          if (key === 'remaining') return totals.remaining != null;
          if (key === 'paid') return totals.paid != null;
          return true;
        };
        const totalRows = {
          total: `$${Number(totals.total || 0).toFixed(2)}`,
          savings: `$${Number(totals.savings || 0).toFixed(2)}`,
          change: `$${Number(totals.change || 0).toFixed(2)}`,
          approved: totals.approved || '',
          thank_you: '',
          remaining: `$${Number(totals.remaining || 0).toFixed(2)}`,
          paid: `$${Number(totals.paid || 0).toFixed(2)}`,
        };
        return (
          // Reference: totals centred in the box, bold by default, savings in the promotion colour
          <Box sx={{ width: '100%', height: '100%', p: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', color: component?.settings?.textColor || '#fff' }}>
            {labels.filter((label) => label.visible !== false && hasValue(label.key)).map((label) => (
              <Typography
                key={label.key}
                sx={{
                  fontSize: component?.settings?.fontSize || 24,
                  fontWeight: component?.settings?.bold === false ? 400 : 700,
                  fontStyle: component?.settings?.italic ? 'italic' : 'normal',
                  textDecoration: component?.settings?.underline ? 'underline' : 'none',
                  color: label.key === 'savings' ? (component?.settings?.promotionColor || '#2ce56f') : (component?.settings?.textColor || '#fff'),
                }}
              >
                {label.label} {totalRows[label.key] || ''}
              </Typography>
            ))}
          </Box>
        );
      }
      case 'image':
        if (isVideoUrl(component?.settings?.src || '')) {
          return <Box component="video" src={getMediaUrl(component.settings.src)} autoPlay muted loop sx={{ width: '100%', height: '100%', objectFit: getObjectFit(component?.settings || {}) }} />;
        }
        if (component?.settings?.src) {
          return <Box component="img" src={getMediaUrl(component.settings.src)} alt="display" sx={{ width: '100%', height: '100%', objectFit: getObjectFit(component?.settings || {}) }} />;
        }
        return (
          <Box sx={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(128,128,128,0.6)', boxSizing: 'border-box' }}>
            <Typography variant="body2" sx={{ color: '#9ca3af' }}>{component?.settings?.fallbackText || 'Select to Add Image'}</Typography>
          </Box>
        );
      case 'slideshow':
        return <SlideShowContent component={component} />;
      case 'text': {
        const customerName = data?.customer?.name || (editable ? 'Customer Name' : '');
        const text = String(component?.settings?.text || '').replace(CUSTOMER_NAME_TOKEN, () => customerName);
        return (
          <Box sx={{ width: '100%', height: '100%', p: 1, color: component?.settings?.color || '#fff', fontSize: component?.settings?.fontSize || 28, fontWeight: component?.settings?.bold ? 700 : 400, fontStyle: component?.settings?.italic ? 'italic' : 'normal', textDecoration: component?.settings?.underline ? 'underline' : 'none' }}>
            {text}
          </Box>
        );
      }
      default:
        return null;
    }
  };

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        // Reference: the editor canvas is the real screen (template background,
        // black by default) so colours and white text read the same as on the
        // customer-facing display; the snap grid is drawn faintly on top.
        bgcolor: template?.defaultBackgroundColor || '#000',
      }}
    >
      {(showEditorCanvasGrid || !hasComponents) && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            backgroundImage: `
              linear-gradient(to right, rgba(128,128,128,0.35) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(128,128,128,0.35) 1px, transparent 1px)
            `,
            backgroundSize: `${100 / Math.max(1, Number(gridCols) || 10)}% ${100 / Math.max(1, Number(gridRows) || 10)}%`,
            zIndex: 0,
          }}
        />
      )}
      {sorted.map((component) => (
        <Box
          key={component.id}
          onClick={() => editable && onSelectComponent?.(component.id)}
          onMouseDown={(event) => {
            if (!editable) return;
            event.stopPropagation();
            onSelectComponent?.(component.id);
            setDragState({
              type: 'move',
              componentId: component.id,
              startX: event.clientX,
              startY: event.clientY,
              component: { x: component.x, y: component.y, w: component.w, h: component.h },
            });
          }}
          sx={{
            position: 'absolute',
            left: `${component.x}%`,
            top: `${component.y}%`,
            width: `${component.w}%`,
            height: `${component.h}%`,
            bgcolor: component?.settings?.backgroundColor || 'transparent',
            border: editable ? `2px solid ${component.id === selectedComponentId ? '#2196f3' : 'transparent'}` : 'none',
            cursor: editable ? 'pointer' : 'default',
            zIndex: Math.max(1, component.zIndex || 1),
          }}
        >
          {renderComponent(component)}
          {editable && component.id === selectedComponentId && resizeHandles.map((handle) => (
            <Box
              key={handle}
              onMouseDown={(event) => {
                event.stopPropagation();
                setDragState({
                  type: 'resize',
                  handle,
                  componentId: component.id,
                  startX: event.clientX,
                  startY: event.clientY,
                  component: { x: component.x, y: component.y, w: component.w, h: component.h },
                });
              }}
              sx={{
                position: 'absolute',
                width: 10,
                height: 10,
                bgcolor: '#fff',
                border: '1px solid #1e88e5',
                borderRadius: '50%',
                ...(handle.includes('n') && { top: -6 }),
                ...(handle.includes('s') && { bottom: -6 }),
                ...(handle.includes('w') && { left: -6 }),
                ...(handle.includes('e') && { right: -6 }),
                ...(handle === 'n' && { left: '50%', transform: 'translateX(-50%)' }),
                ...(handle === 's' && { left: '50%', transform: 'translateX(-50%)' }),
                ...(handle === 'e' && { top: '50%', transform: 'translateY(-50%)' }),
                ...(handle === 'w' && { top: '50%', transform: 'translateY(-50%)' }),
                cursor: `${handle}-resize`,
                zIndex: 2,
              }}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
};

export default CustomerDisplayRenderer;
