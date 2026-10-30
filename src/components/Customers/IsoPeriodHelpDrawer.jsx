import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  Button,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { Close as CloseIcon, OpenInNew as OpenIcon } from '@mui/icons-material';

// Reference: Customer Group > Account Sales > Credit Terms, "It must be formatted
// as an ISO 8601 duration." opens help article 27899706774157 in a right drawer.

const ARTICLE_URL = 'https://support.onshopfront.com/hc/en-us/articles/27899706774157-ISO-8601-Period-Format';

const DESIGNATORS = [
  ['P', 'The duration designator, placed at the start of the duration representation'],
  ['Y', 'The year designator, follows the value for the number of years'],
  ['M', 'The month designator, follows the value for the number of months (before T)'],
  ['W', 'The week designator, follows the value for the number of weeks'],
  ['D', 'The day designator, follows the value for the number of days'],
  ['T', 'The time designator, precedes the time components of the representation'],
  ['H', 'The hour designator, follows the value for the number of hours (after T)'],
  ['M', 'The minute designator, follows the value for the number of minutes (after T)'],
  ['S', 'The second designator, follows the value for the number of seconds (after T)'],
];

const EXAMPLES = [
  ['P7D', '7 days'],
  ['P14D', '14 days'],
  ['P30D', '30 days'],
  ['P2W', '2 weeks'],
  ['P1M', '1 month'],
  ['P3Y6M4DT12H30M5S', '3 years, 6 months, 4 days, 12 hours, 30 minutes and 5 seconds'],
];

const headSx = { '& th': { fontWeight: 700, fontSize: 16, color: '#000', borderBottom: '2px solid #000' } };
const cellSx = { '& td': { fontSize: 16, color: '#000', borderBottom: '1px solid #ddd', verticalAlign: 'top' } };

const SimpleTable = ({ headers, rows }) => (
  <Table size="small" sx={{ mb: 3 }}>
    <TableHead><TableRow sx={headSx}>{headers.map((h) => <TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead>
    <TableBody>
      {rows.map((r, i) => (
        <TableRow key={i} sx={cellSx}>
          {r.map((c, j) => <TableCell key={j} sx={j === 0 ? { fontFamily: 'monospace', fontWeight: 700, whiteSpace: 'nowrap' } : undefined}>{c}</TableCell>)}
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export default function IsoPeriodHelpDrawer({ open, onClose }) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{ zIndex: 1400 }}
      PaperProps={{ sx: { width: 'min(770px, 100vw)', display: 'flex', flexDirection: 'column', boxShadow: 'none' } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', px: 3, pt: 2 }}>
        <Button
          onClick={onClose}
          startIcon={<CloseIcon sx={{ fontSize: 18 }} />}
          sx={{ ml: 'auto', color: '#000', fontSize: 16, fontWeight: 700, textTransform: 'none' }}
        >
          Close
        </Button>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', px: 4, pb: 4 }}>
        <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000', mb: 1 }}>ISO 8601 Period Format</Typography>
        <Typography sx={{ fontSize: 16, color: '#444', mb: 3 }}>
          <Link href={ARTICLE_URL} target="_blank" rel="noopener noreferrer" sx={{ color: 'rgb(0,0,238)', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            Open externally <OpenIcon sx={{ fontSize: 16 }} />
          </Link>
        </Typography>

        <Typography sx={{ fontSize: 16, color: '#000', mb: 2 }}>
          Shopfront uses the ISO 8601 Period format to define a period of time. A period starts with a P (for
          Period), followed by a number and a designator. Multiple number and designator pairs can be combined.
        </Typography>

        <Typography component="h2" sx={{ fontSize: 24, fontWeight: 700, color: '#000', mt: 3, mb: 1.5 }}>Designators</Typography>
        <SimpleTable headers={['Designator', 'Meaning']} rows={DESIGNATORS} />

        <Typography component="h2" sx={{ fontSize: 24, fontWeight: 700, color: '#000', mt: 3, mb: 1.5 }}>Examples</Typography>
        <SimpleTable headers={['Period', 'Represents']} rows={EXAMPLES} />
      </Box>
    </Drawer>
  );
}
