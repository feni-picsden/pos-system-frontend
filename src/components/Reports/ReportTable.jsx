import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  IconButton,
  Typography,
} from '@mui/material';
import { KeyboardArrowLeft, KeyboardArrowRight } from '@mui/icons-material';
import { byMode } from '../../theme/sfPalette';

const ReportTable = ({ data, columns, hideFooter = false, maxHeight = 400, referenceSizing = false }) => {
  const totalMinWidth = (columns || []).reduce((sum, column) => {
    const columnWidth = Number(column?.width) || 140;
    return sum + columnWidth;
  }, 0);
  const fillParentHeight = maxHeight === '100%';

  return (
    <Box
      sx={{
        width: '100%',
        ...(fillParentHeight
          ? {
              height: '100%',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }
          : {}),
      }}
    >
      <TableContainer
        component={Paper}
        sx={{
          maxHeight,
          boxShadow: 'none',
          borderRadius: 0,
          overflowX: 'auto',
          overflowY: 'auto',
          ...(fillParentHeight
            ? {
                flex: 1,
                minHeight: 0,
              }
            : {}),
        }}
      >
        <Table stickyHeader size="small" sx={{ minWidth: totalMinWidth, ...(referenceSizing ? { tableLayout: 'fixed' } : {}) }}>
          {referenceSizing && <colgroup>{columns.map(column => <col key={column.field} style={{ width: column.percentWidth }} />)}</colgroup>}
          <TableHead>
            <TableRow
              sx={{
                '& th': {
                  backgroundColor: byMode('#5ebbeb', '#333333'),
                  color: byMode('#f8f8f8', '#5ebbeb'),
                  fontWeight: 700,
                  fontSize: 16,
                  textTransform: 'uppercase',
                  padding: '8px',
                  height: 36,
                  borderBottom: 'none',
                  ...(referenceSizing ? { lineHeight: '20px', boxSizing: 'border-box', padding: '8px' } : {}),
                },
              }}
            >
              {columns.map((column) => (
                <TableCell
                  key={column.field}
                  align={column.align || 'left'}
                  style={referenceSizing ? undefined : { width: column.width, minWidth: column.width }}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  {column.headerName}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row, index) => {
              const isTotal = Boolean(row?.__isTotal || row?.isTotalRow);
              return (
                <TableRow
                  key={index}
                  sx={{
                    bgcolor: isTotal ? byMode('#5ebbeb', '#333333') : index % 2 === 0 ? (referenceSizing ? byMode('#f7f7f7', '#232323') : byMode('#fff', '#232323')) : (referenceSizing ? byMode('#dedede', '#2a2a2a') : byMode('#f8f8f8', '#2a2a2a')),
                    '& td': {
                      color: isTotal ? byMode('#f8f8f8', '#5ebbeb') : byMode('#000', '#f8f8f8'),
                      fontWeight: isTotal ? 700 : 400,
                      fontSize: 16,
                      padding: '8px 8px 8px 10px',
                      borderBottom: 'none',
                      ...(referenceSizing ? { height: 36, lineHeight: '20px', boxSizing: 'border-box', padding: '8px 10px' } : {}),
                    },
                  }}
                >
                  {columns.map((column) => (
                    <TableCell key={column.field} align={column.align || 'left'}>
                      {column.format ? column.format(row[column.field], row)
                        : column.valueFormatter ? column.valueFormatter(row[column.field], row) : row[column.field]}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {!hideFooter && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton size="small">
              <KeyboardArrowLeft />
            </IconButton>
            <Typography variant="body2" sx={{ mx: 1 }}>
              Page 1 of 1
            </Typography>
            <IconButton size="small">
              <KeyboardArrowRight />
            </IconButton>
          </Box>
          <Typography variant="body2">{data.length} items</Typography>
        </Box>
      )}
    </Box>
  );
};

export default ReportTable;
