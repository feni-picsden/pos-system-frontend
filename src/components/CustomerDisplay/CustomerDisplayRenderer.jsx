import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';

const isVideoUrl = (url = '') => /\.(mp4|webm|mov|ogg)$/i.test(url);
const getObjectFit = (settings = {}) => {
  if (settings.stretchToFill) return 'fill';
  if (settings.stretchToCover) return 'cover';
  if (settings.containWidth || settings.containHeight) return 'contain';
  return 'cover';
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
      <Box sx={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          {component?.settings?.fallbackText || 'No slides configured'}
        </Typography>
      </Box>
    );
  }

  const activeSlide = slides[index % slides.length];
  if (isVideoUrl(activeSlide.url)) {
    return <Box component="video" src={activeSlide.url} autoPlay muted loop sx={{ width: '100%', height: '100%', objectFit: getObjectFit(component?.settings || {}) }} />;
  }

  return <Box component="img" src={activeSlide.url} alt="slide" sx={{ width: '100%', height: '100%', objectFit: getObjectFit(component?.settings || {}) }} />;
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
        const headers = (component?.settings?.headers || [
          { key: 'product', label: 'Product', visible: true, align: 'Default' },
          { key: 'quantity', label: 'Quantity', visible: true, align: 'Default' },
          { key: 'price', label: 'Price', visible: true, align: 'Default' },
          { key: 'total', label: 'Total', visible: true, align: 'Default' },
        ]).filter((header) => header.visible !== false);
        const columnTemplate = headers.map(() => '1fr').join(' ');
        const alignMap = { Left: 'left', Center: 'center', Right: 'right', Default: 'left' };
        return (
          <Box sx={{ width: '100%', height: '100%', p: 1, color: component?.settings?.textColor || '#fff', fontSize: component?.settings?.fontSize || 24 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: columnTemplate, fontWeight: 700, mb: 1 }}>
              {headers.map((header) => (
                <span key={header.key} style={{ textAlign: alignMap[header.align] || 'left' }}>{header.label}</span>
              ))}
            </Box>
            {items.slice(0, 8).map((item) => (
              <Box key={`${item.id}-${item.timestamp || item.name}`} sx={{ display: 'grid', gridTemplateColumns: columnTemplate, mb: 0.5, borderBottom: component?.settings?.showGrid ? `1px solid ${component?.settings?.gridLineColor || '#000'}` : 'none' }}>
                {headers.map((header) => (
                  <span key={header.key} style={{ textAlign: alignMap[header.align] || 'left', color: header.key === 'product' && item.isPromotion ? (component?.settings?.promotionColor || '#2ce56f') : undefined }}>
                    {header.key === 'product' ? item.name : header.key === 'quantity' ? (item.quantity || 1) : header.key === 'price' ? `$${Number(item.unitPrice || 0).toFixed(2)}` : `$${Number(item.totalPrice || item.price || 0).toFixed(2)}`}
                  </span>
                ))}
              </Box>
            ))}
            <Box sx={{ mt: 'auto', pt: 1, fontSize: 32, textAlign: 'right', color: component?.settings?.footerTextColor || '#fff', bgcolor: component?.settings?.footerBackgroundColor || 'transparent' }}>{Number(totals.itemCount || 0)} Items</Box>
          </Box>
        );
      }
      case 'totals': {
        const labels = component?.settings?.labels || [
          { key: 'total', label: 'Total:', visible: true },
          { key: 'savings', label: 'Savings:', visible: true },
        ];
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
          <Box sx={{ width: '100%', height: '100%', p: 2, color: component?.settings?.textColor || '#fff' }}>
            {labels.filter((label) => label.visible !== false).map((label) => (
              <Typography
                key={label.key}
                sx={{
                  fontSize: component?.settings?.fontSize || 45,
                  fontWeight: component?.settings?.bold ? 700 : 400,
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
          return <Box component="video" src={component.settings.src} autoPlay muted loop sx={{ width: '100%', height: '100%', objectFit: getObjectFit(component?.settings || {}) }} />;
        }
        if (component?.settings?.src) {
          return <Box component="img" src={component.settings.src} alt="display" sx={{ width: '100%', height: '100%', objectFit: getObjectFit(component?.settings || {}) }} />;
        }
        return (
          <Box sx={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2">{component?.settings?.fallbackText || 'Select to Add Image'}</Typography>
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
        // In editor mode, keep a SaleKey-like white grid canvas regardless of component count.
        bgcolor: showEditorCanvasGrid
          ? '#f7f7f7'
          : hasComponents
          ? (template?.defaultBackgroundColor || '#000')
          : '#f7f7f7',
      }}
    >
      {(showEditorCanvasGrid || !hasComponents) && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            backgroundImage: `
              linear-gradient(to right, rgba(0,0,0,0.12) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0,0,0,0.12) 1px, transparent 1px)
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
