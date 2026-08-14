import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from '@mui/material';
import {
  CheckOutlined as CheckIcon,
  CloseOutlined as CloseIcon,
} from '@mui/icons-material';
import emailLogService from '../../services/emailLogService';

// Reference column proportions at 1889px table width
const COLUMNS = [
  { key: 'status', label: 'Status', width: '6.0%' },
  { key: 'recipient', label: 'Recipient', width: '25.0%' },
  { key: 'subject', label: 'Subject', width: '40.0%' },
  { key: 'sentAt', label: 'Sent At', width: '21.2%' },
  { key: 'hasAttachment', label: 'Has Attachment', width: '7.8%' },
];

const cellSx = {
  p: '16px',
  fontFamily: 'Roboto, sans-serif', // reference font stack; Helvetica/Arial fallbacks measure wider
  fontSize: 16,
  lineHeight: '19px', // 16 + 19 + 16 = 51px row height (reference)
  fontWeight: 400,
  color: '#000', // reference solid rgb(0,0,0), not MUI's rgba(0,0,0,0.87)
  border: 'none',
  whiteSpace: 'normal',
  overflow: 'visible',
  textOverflow: 'clip',
};

// Reference Subject cell has Tailwind 'truncate': only this column clips long text.
const subjectCellSx = {
  ...cellSx,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const MailLog = () => {
  const [emailLogs, setEmailLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchEmailLogs();
  }, []);

  const fetchEmailLogs = async () => {
    try {
      setLoading(true);
      setError('');

      // Get emails from last 3 months
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const filters = {
        startDate: threeMonthsAgo.toISOString(),
        limit: 1000, // Get all emails from last 3 months
      };

      const response = await emailLogService.getEmailLogs(filters);

      if (response && response.emailLogs) {
        setEmailLogs(response.emailLogs);
        setTotalCount(response.pagination?.total || response.emailLogs.length);
      }
    } catch (err) {
      console.error('Error fetching email logs:', err);
      setError(err.response?.data?.error || 'Failed to fetch email logs');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  const getStatusDisplay = (status) => {
    return (status || '').toUpperCase();
  };

  const getStatusColor = (status) => {
    const upperStatus = (status || '').toUpperCase();
    if (upperStatus === 'DELIVERED' || upperStatus === 'OPENED') {
      return '#15803d'; // green-700 (reference)
    } else if (upperStatus === 'FAILED' || upperStatus === 'BOUNCED') {
      return '#b91c1c'; // red-700 (reference)
    } else if (upperStatus === 'SENT') {
      return '#0284c7';
    }
    return '#676b72';
  };

  const getRecipient = (receiverEmails) => {
    if (Array.isArray(receiverEmails)) {
      return receiverEmails[0] || 'N/A';
    }
    return receiverEmails || 'N/A';
  };

  return (
    <Box sx={{ px: '8px', pt: '8px', pb: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 2,
        }}
      >
        <Typography
          variant="h1"
          sx={{ fontSize: 32, fontWeight: 700, color: '#000000', lineHeight: 1.2 }}
        >
          Mail Log
        </Typography>
        {/* Reference top-right area has ONLY Total Count + notice — no controls. */}
        <Box sx={{ textAlign: 'right' }}>
          <Typography
            variant="h3"
            sx={{ fontSize: '18.72px', fontWeight: 700, color: '#000000', lineHeight: 1.2 }}
          >
            Total Count: {totalCount}
          </Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 400, color: '#374151', mt: '5px' }}>
            Mail is limited to the last 3 months
          </Typography>
        </Box>
      </Box>

      {error && (
        <Box sx={{ mb: 2, p: 2, bgcolor: '#ffebee', color: '#c62828', borderRadius: 1 }}>
          {error}
        </Box>
      )}

      {/* Email Logs Table — full-bleed, no card/Paper (reference has none) */}
      {/* overflow:visible (not MUI's default overflow-x:auto) so the PAGE, not this
          unbounded container, is the header's sticky scrollport — otherwise it never pins. */}
      <TableContainer sx={{ boxShadow: 'none', bgcolor: 'transparent', overflow: 'visible' }}>
        <Table sx={{ tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}>
          <TableHead>
            <TableRow sx={{ height: 51 }}>
              {COLUMNS.map((col, i) => (
                <TableCell
                  key={col.key}
                  sx={{
                    width: col.width,
                    bgcolor: '#5ebbeb',
                    color: '#ffffff',
                    fontSize: 16,
                    lineHeight: '19px', // 16 + 19 + 16 = 51px header height (reference)
                    fontWeight: 700,
                    p: '16px',
                    border: 'none',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    whiteSpace: 'nowrap',
                    borderTopLeftRadius: i === 0 ? 12 : 0,
                    borderBottomLeftRadius: i === 0 ? 12 : 0,
                    borderTopRightRadius: i === COLUMNS.length - 1 ? 12 : 0,
                    borderBottomRightRadius: i === COLUMNS.length - 1 ? 12 : 0,
                  }}
                >
                  {col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4, border: 'none' }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : emailLogs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  align="center"
                  sx={{ py: 4, border: 'none', fontSize: 16, color: '#676b72' }}
                >
                  No email logs found
                </TableCell>
              </TableRow>
            ) : (
              emailLogs.map((log) => (
                <TableRow key={log.id} sx={{ height: 51, bgcolor: '#ffffff' }}>
                  <TableCell sx={{ ...cellSx, color: getStatusColor(log.status) }}>
                    {getStatusDisplay(log.status)}
                  </TableCell>
                  <TableCell sx={cellSx}>{getRecipient(log.receiverEmails)}</TableCell>
                  <TableCell sx={subjectCellSx}>{log.subject}</TableCell>
                  <TableCell sx={cellSx}>{formatDate(log.sentAt)}</TableCell>
                  <TableCell sx={{ ...cellSx, textAlign: 'center' }}>
                    {log.hasAttachment ? (
                      <CheckIcon sx={{ color: '#15803d', fontSize: 16, display: 'block', mx: 'auto' }} />
                    ) : (
                      // ponytail: FALSE branch is unverified against the reference (no FALSE rows there);
                      // left as the existing local rendering, only centring changed.
                      <CloseIcon sx={{ color: '#b91c1c', fontSize: 16, display: 'block', mx: 'auto' }} />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default MailLog;
