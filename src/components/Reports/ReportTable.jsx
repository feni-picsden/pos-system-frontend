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

const ReportTable = ({ data, columns, hideFooter = false, maxHeight = 400 }) => {
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
        <Table stickyHeader size="small" sx={{ minWidth: totalMinWidth }}>
          <TableHead>
            <TableRow
              sx={{
                '& th': {
                  backgroundColor: '#5ebbeb',
                  color: '#f8f8f8',
                  fontWeight: 700,
                  fontSize: 16,
                  textTransform: 'uppercase',
                  padding: '8px',
                  height: 36,
                  borderBottom: 'none',
                },
              }}
            >
              {columns.map((column) => (
                <TableCell
                  key={column.field}
                  align={column.align || 'left'}
                  style={{ width: column.width, minWidth: column.width }}
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
                    bgcolor: isTotal ? '#5ebbeb' : index % 2 === 0 ? '#fff' : '#f8f8f8',
                    '& td': {
                      color: isTotal ? '#f8f8f8' : '#000',
                      fontWeight: isTotal ? 700 : 400,
                      fontSize: 16,
                      padding: '8px 8px 8px 10px',
                      borderBottom: 'none',
                    },
                  }}
                >
                  {columns.map((column) => (
                    <TableCell key={column.field} align={column.align || 'left'}>
                      {column.format ? column.format(row[column.field], row) : row[column.field]}
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
