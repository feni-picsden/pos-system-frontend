import React from 'react';
import { Box } from '@mui/material';
import {
  renderStatementBlock,
  orderStatementComponents,
  statementBlockGapSx,
} from './statementBlocks';

/**
 * Statement Renderer
 * Renders a customer statement from template.config.components using live
 * statement data. Every block is drawn by statementBlocks.renderStatementBlock —
 * the SAME code the editor canvas draws with — so the editor, its Preview, the
 * Customers > Balance view and the printed statement all match.
 */
const StatementRenderer = ({ statementData, template }) => {
  const components = template?.config?.components || [];
  if (!statementData || components.length === 0) return null;

  return (
    <Box>
      {orderStatementComponents(components)
        .filter((c) => c && c.visible !== false)
        .map((component, index) => (
          <Box key={component.id || index} sx={statementBlockGapSx}>
            {renderStatementBlock(component, statementData)}
          </Box>
        ))}
    </Box>
  );
};

export default StatementRenderer;
