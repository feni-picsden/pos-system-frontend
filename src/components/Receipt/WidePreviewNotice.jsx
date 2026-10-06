import React from 'react';
import { Box } from '@mui/material';
import { DescriptionOutlined } from '@mui/icons-material';
import ReceiptRenderer from './ReceiptRenderer';

/**
 * The reference cannot render an A4 / Email template into the receipt preview and
 * says so, centred, rather than drawing the wrong paper. Print and Email still work.
 * One component for every preview pane (Sale Complete, Reprint Receipt), so the
 * notice looks the same everywhere.
 *
 * The real receipt tree still MOUNTS (hidden): the print paths copy document.head's
 * emotion <style> tags, and renderToStaticMarkup cannot insert them itself.
 */
const WidePreviewNotice = ({ template, receiptData }) => {
  const label = /email/i.test(template?.type || template?.config?.layout || '') ? 'Email' : 'A4';
  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 220,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        color: '#313439',
      }}
    >
      <DescriptionOutlined sx={{ fontSize: 56, color: '#f5a623' }} />
      <Box sx={{ fontWeight: 700 }}>{label}</Box>
      <Box>Receipt preview unsupported</Box>
      {receiptData && (
        <Box sx={{ display: 'none' }} aria-hidden>
          <ReceiptRenderer receiptData={receiptData} template={template} />
        </Box>
      )}
    </Box>
  );
};

export default WidePreviewNotice;
