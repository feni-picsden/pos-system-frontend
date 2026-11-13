import React, { useMemo } from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import { Box } from '@mui/material';

// Reference-style JavaScript editor (Setup > Page Rules): white panel, grey line
// numbers in a gutter, light syntax colours, monospace 13px, scrolls inside.

const TOKEN_COLOURS = {
  '& .token.comment': { color: '#8e8e8e' },
  '& .token.keyword': { color: '#0b63c6' },
  '& .token.string, & .token.template-string': { color: '#1a8f3a' },
  '& .token.template-punctuation': { color: '#1a8f3a' },
  '& .token.interpolation-punctuation': { color: '#b02a2a' },
  '& .token.number, & .token.boolean': { color: '#d14' },
  '& .token.function': { color: '#b0269a' },
  '& .token.operator': { color: '#b02a2a' },
  '& .token.punctuation': { color: '#777' },
  '& .token.property': { color: '#444' },
};

const CodeEditor = ({ value, onChange, readOnly = false, height = 'calc(100vh - 260px)', ariaLabel = 'Code' }) => {
  const lines = useMemo(() => String(value || '').split('\n').length, [value]);
  return (
    <Box
      data-testid="code-editor"
      sx={{
        display: 'flex', border: '1px solid #c7c7c7', borderRadius: '4px', bgcolor: '#fff', height, overflow: 'auto',
        fontFamily: '"Roboto Mono", Consolas, "Courier New", monospace', fontSize: 13, lineHeight: '20px',
      }}
    >
      <Box aria-hidden sx={{ flexShrink: 0, textAlign: 'right', color: '#6b6b6b', pl: 1.5, pr: 1, py: '10px', userSelect: 'none', bgcolor: '#fff' }}>
        {Array.from({ length: lines }).map((_, i) => <div key={i}>{i + 1}</div>)}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, ...TOKEN_COLOURS, '& textarea': { outline: 'none' } }}>
        <Editor
          value={value}
          onValueChange={onChange}
          highlight={(code) => Prism.highlight(code, Prism.languages.javascript, 'javascript')}
          padding={10}
          readOnly={readOnly}
          textareaId="page-rule-code"
          textareaClassName="page-rule-textarea"
          style={{ fontFamily: 'inherit', fontSize: 13, lineHeight: '20px', minHeight: '100%', whiteSpace: 'pre' }}
          placeholder="function entry(context) { ... }"
          aria-label={ariaLabel}
        />
      </Box>
    </Box>
  );
};

export default CodeEditor;
