import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { BlockOutlined as NoneIcon } from '@mui/icons-material';
import settingsService from '../../services/settingsService';

// Enterprise Policies — reference parity, captured live from the reference
// store 2026-08-31 (no help-centre article exists; see
// docs/parity/setup-logic/enterprise-policies.md). A read-only status page:
// enterprise (franchise / head-office) connections above, the policy table
// below. Policies default to platform-enforced values; a real enterprise
// connection would override them via the `enterprise_policies` settings key.

// Owner decision 2026-08-31: mirror the reference account (topdrops) verbatim —
// show exactly what that account shows, no extra subscription features.
const PLATFORM = 'Shopfront';

// Reference defaults, one row per policy. `json: true` renders the value as a
// code block, matching the reference's JSON-array cells.
const DEFAULT_POLICIES = [
  { name: 'Master File Address', enforcedBy: PLATFORM, value: 'https://posliquor.com.au/enterprise' },
  { name: 'Display Enterprise Login', enforcedBy: PLATFORM, value: 'disabled' },
  { name: 'Product Creation Source', enforcedBy: PLATFORM, value: 'all' },
  { name: 'Product Update Source', enforcedBy: PLATFORM, value: 'all' },
  { name: 'Product Delete Source', enforcedBy: PLATFORM, value: 'all' },
  { name: 'Gift Card Sources', enforcedBy: PLATFORM, value: '[]', json: true },
  { name: 'Promotion Category Sources', enforcedBy: PLATFORM, value: '[]', json: true },
  { name: 'Order Cost Adjustments', enforcedBy: PLATFORM, value: 'enabled' },
];

const EnterprisePolicies = () => {
  const [connections, setConnections] = useState([]);
  const [policies, setPolicies] = useState(DEFAULT_POLICIES);

  useEffect(() => {
    // Overrides land here when an enterprise connection exists:
    // { connections: [{name}], policies: [{name, enforcedBy, value, json}] }.
    (async () => {
      try {
        const res = await settingsService.getSetting('enterprise_policies');
        const value = res?.setting?.value;
        if (Array.isArray(value?.connections)) setConnections(value.connections);
        if (Array.isArray(value?.policies) && value.policies.length > 0) {
          const byName = new Map(value.policies.map((p) => [p.name, p]));
          setPolicies(DEFAULT_POLICIES.map((p) => ({ ...p, ...(byName.get(p.name) || {}) })));
        }
      } catch {
        /* nothing stored — platform defaults stand */
      }
    })();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000', mb: 1 }}>
        Enterprise Connections
      </Typography>
      <Typography sx={{ fontSize: 15, color: '#313439', mb: 4 }}>
        Overall, your application is managed by {PLATFORM}.
      </Typography>

      {connections.length === 0 ? (
        // Reference empty state: large slashed-circle glyph beside the headline.
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, py: 6 }}>
          <NoneIcon sx={{ fontSize: 120, color: '#000' }} />
          <Box>
            <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#000', mb: 1 }}>
              No Enterprise Connections
            </Typography>
            <Typography sx={{ fontSize: 15, color: '#313439' }}>
              You're not connected to any enterprises.
            </Typography>
          </Box>
        </Box>
      ) : (
        <Box sx={{ mb: 4 }}>
          {connections.map((connection, index) => (
            <Typography key={index} sx={{ fontSize: 16, color: '#313439', py: 0.5 }}>
              {connection.name || String(connection)}
            </Typography>
          ))}
        </Box>
      )}

      <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#000', mb: 1.5 }}>
        Policies
      </Typography>
      <TableContainer>
        <Table sx={{ borderCollapse: 'collapse', '& td, & th': { border: '1px solid #d5d9d8', fontSize: 15, color: '#313439', py: 1.5 } }}>
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 700 } }}>
              <TableCell sx={{ width: '46%' }}>Name</TableCell>
              <TableCell sx={{ width: '20%' }}>Enforced By</TableCell>
              <TableCell>Value</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {policies.map((policy, index) => (
              <TableRow key={policy.name} sx={{ bgcolor: index % 2 ? '#fff' : '#fafafa' }}>
                <TableCell>{policy.name}</TableCell>
                <TableCell>{policy.enforcedBy}</TableCell>
                <TableCell>
                  {policy.json ? (
                    <Box component="code" sx={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 13.5, bgcolor: '#f0f2f2', px: 1, py: 0.5, borderRadius: 1, display: 'inline-block' }}>
                      {policy.value}
                    </Box>
                  ) : (
                    policy.value
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default EnterprisePolicies;
