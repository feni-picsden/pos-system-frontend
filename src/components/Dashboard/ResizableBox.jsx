import React, { useState } from 'react';
import { Box, Paper } from '@mui/material';
import PropTypes from 'prop-types';

const ResizableBox = ({ 
  children, 
  initialWidth = '100%', 
  initialHeight = 300,
  minWidth = 200,
  minHeight = 100,
  maxWidth = '100%',
  maxHeight = 800,
  onResize,
  style,
  ...props 
}) => {
  const [width, setWidth] = useState(initialWidth);
  const [height, setHeight] = useState(initialHeight);
  const [resizing, setResizing] = useState(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startDimensions, setStartDimensions] = useState({ width: 0, height: 0 });

  // Start resizing
  const handleMouseDown = (e, direction) => {
    e.preventDefault();
    setResizing(direction);
    setStartPos({ x: e.clientX, y: e.clientY });
    
    // Get current dimensions
    const currentWidth = typeof width === 'string' ? 
      parseFloat(width) / 100 * document.documentElement.clientWidth : 
      width;
    
    setStartDimensions({ 
      width: currentWidth, 
      height 
    });
    
    // Add event listeners for mouse movement and release
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle mouse movement during resize
  const handleMouseMove = (e) => {
    if (!resizing) return;
    
    const deltaX = e.clientX - startPos.x;
    const deltaY = e.clientY - startPos.y;
    
    if (resizing === 'right' || resizing === 'bottom-right') {
      let newWidth = startDimensions.width + deltaX;
      
      // Convert to percentage if initialWidth was a percentage
      if (typeof initialWidth === 'string' && initialWidth.includes('%')) {
        const containerWidth = document.documentElement.clientWidth;
        newWidth = `${(newWidth / containerWidth) * 100}%`;
      }
      
      // Apply min/max constraints
      if (typeof newWidth === 'number') {
        if (newWidth < minWidth) newWidth = minWidth;
        if (typeof maxWidth === 'number' && newWidth > maxWidth) newWidth = maxWidth;
      }
      
      setWidth(newWidth);
    }
    
    if (resizing === 'bottom' || resizing === 'bottom-right') {
      let newHeight = startDimensions.height + deltaY;
      
      // Apply min/max constraints
      if (newHeight < minHeight) newHeight = minHeight;
      if (newHeight > maxHeight) newHeight = maxHeight;
      
      setHeight(newHeight);
    }
    
    // Call the onResize callback if provided
    if (onResize) {
      onResize({ width, height });
    }
  };

  // End resizing
  const handleMouseUp = () => {
    setResizing(null);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  return (
    <Box
      sx={{
        position: 'relative',
        width,
        height,
        ...style
      }}
      {...props}
    >
      {children}
      
      {/* Right resize handle */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '5px',
          height: '100%',
          cursor: 'ew-resize',
          zIndex: 10,
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
          }
        }}
        onMouseDown={(e) => handleMouseDown(e, 'right')}
      />
      
      {/* Bottom resize handle */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '5px',
          cursor: 'ns-resize',
          zIndex: 10,
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
          }
        }}
        onMouseDown={(e) => handleMouseDown(e, 'bottom')}
      />
      
      {/* Bottom-right resize handle */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '10px',
          height: '10px',
          cursor: 'nwse-resize',
          zIndex: 20,
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 3,
            right: 3,
            width: 5,
            height: 5,
            borderRight: '2px solid rgba(0, 0, 0, 0.4)',
            borderBottom: '2px solid rgba(0, 0, 0, 0.4)',
          }
        }}
        onMouseDown={(e) => handleMouseDown(e, 'bottom-right')}
      />
    </Box>
  );
};

ResizableBox.propTypes = {
  children: PropTypes.node.isRequired,
  initialWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  initialHeight: PropTypes.number,
  minWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  minHeight: PropTypes.number,
  maxWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  maxHeight: PropTypes.number,
  onResize: PropTypes.func,
  style: PropTypes.object
};

export default ResizableBox;
