import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  MenuItem,
  Switch,
  CircularProgress,
  Alert,
  Autocomplete,
  InputAdornment,
} from '@mui/material';
import { useAppDialogs } from './AppDialogProvider';

// Renders a custom Page Rule's questions (Settings > Page Rules; reference
// art. 360021629152). The rule itself runs in the sandbox (utils/pageRuleSandbox);
// this component drives the ask/answer loop and renders each Question's elements.
//
// props:
//   session      — a createPageRuleSession() result
//   user         — { name, username, role, permissions } for the rule context
//   location     — { outlet, register } for the rule context
//   dbFetch      — async (databaseName) => [{ label, value }] for select elements
//   onFinish     — (fields, answers) => void; fields = { field: value } accumulated
//   onCancel     — () => void
//   title        — fallback heading while the first question loads

const PageRuleWizard = ({ session, user, location, dbFetch, onFinish, onCancel }) => {
  const { notify, alert } = useAppDialogs();
  const [question, setQuestion] = useState(null);
  const [values, setValues] = useState({});
  const [dbOptions, setDbOptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const answersRef = useRef([]); // [{question, elements:[{field,value}], metaData}]
  const fieldsRef = useRef({}); // accumulated field -> value (answers + setField)
  const questionIndexRef = useRef(0);
  const finishedRef = useRef(false);

  const buildContext = () => ({
    user: {
      name: user?.name || '',
      username: user?.username || user?.name || '',
      role: user?.role ? { id: String(user.role.id ?? user.role) } : null,
      permissions: user?.permissions || [],
    },
    answers: answersRef.current,
    currentQuestion: questionIndexRef.current,
    currentLocation: {
      outlet: location?.outlet ? { id: String(location.outlet.id), name: location.outlet.name } : null,
      register: location?.register ? { id: String(location.register.id), name: location.register.name } : null,
    },
  });

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish(fieldsRef.current, answersRef.current);
  };

  const askCurrent = async () => {
    try {
      setLoading(true);
      setError('');
      const q = await session.ask(buildContext());
      // Load any internal-database select options this question references.
      const loads = {};
      for (const el of q.elements || []) {
        if (el.type === 'select' && typeof el.options === 'string') {
          try {
            loads[el.options] = await dbFetch(el.options);
          } catch {
            loads[el.options] = [];
          }
        }
      }
      setDbOptions(loads);
      // Seed defaults.
      const seeded = {};
      for (const el of q.elements || []) {
        if (el.field) {
          seeded[el.field] =
            fieldsRef.current[el.field] ?? el.default ?? (el.type === 'toggle' ? false : el.multiple ? [] : '');
        }
      }
      setValues(seeded);
      setQuestion(q);
    } catch (e) {
      setError(e?.message || 'The Page Rule failed — the full form will be used instead.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { askCurrent(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Host actions raised by the rule via ShopfrontAPI.
  useEffect(() => {
    // The session's onHostAction was bound at creation by the caller; this
    // component receives them through the sessionActions ref the caller wires.
    if (!session) return undefined;
    session.hostActionHandler = (action, payload) => {
      switch (action) {
        case 'toast': {
          const kind = payload.toastType === 'information' ? 'info' : payload.toastType;
          if (kind === 'success') notify(payload.toastMessage, 'success');
          else alert(payload.toastMessage, kind || 'info');
          break;
        }
        case 'setField':
          fieldsRef.current[payload.field] = payload.value;
          break;
        case 'redirect':
          window.location.assign(payload.address);
          break;
        case 'back':
          goBack();
          break;
        case 'next':
          goNext();
          break;
        case 'finish':
          finish();
          break;
        default:
          break;
      }
    };
    return () => { session.hostActionHandler = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, question]);

  const recordAnswer = () => {
    const elements = (question?.elements || [])
      .filter((el) => el.field)
      .map((el) => ({ field: el.field, value: values[el.field] }));
    elements.forEach((el) => { fieldsRef.current[el.field] = el.value; });
    answersRef.current = [
      ...answersRef.current,
      { question: question?.question || '', elements, metaData: question?.metaData },
    ];
  };

  const goNext = () => {
    // Required check per element.
    for (const el of question?.elements || []) {
      if (el.required && el.field) {
        const v = values[el.field];
        const empty = v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
        if (empty) {
          setError(`"${el.placeholder || el.field}" is required`);
          return;
        }
      }
    }
    recordAnswer();
    if ((question?.questionsLeft ?? 1) <= 0) {
      finish();
      return;
    }
    questionIndexRef.current += 1;
    askCurrent();
  };

  const goBack = () => {
    if (questionIndexRef.current === 0) { onCancel?.(); return; }
    answersRef.current = answersRef.current.slice(0, -1);
    questionIndexRef.current -= 1;
    askCurrent();
  };

  const setValue = (field, value) => setValues((prev) => ({ ...prev, [field]: value }));

  // ── custom element renderer ─────────────────────────────────────────────────
  const renderCustom = (node, elementIndex, path = String(elementIndex), isRoot = true) => {
    if (!node) return null;
    const children = [
      node.textNode,
      ...(node.children || []).map((child, i) => renderCustom(child, elementIndex, `${path}.${i}`, false)),
    ].filter((c) => c !== undefined && c !== null);
    const props = { key: path, ...(node.attributes || {}) };
    // Events are honoured on the first parent only, per the reference.
    if (isRoot) {
      for (const eventName of node.events || []) {
        const reactEvent = eventName === 'change' ? 'onChange' : eventName === 'click' ? 'onClick' : null;
        if (!reactEvent) continue;
        props[reactEvent] = async (e) => {
          try {
            const result = await session.fireEvent(question.askId, path, {
              type: eventName,
              value: e?.target?.value ?? null,
            });
            if (result && question.elements[elementIndex]?.field !== undefined) {
              setValue(question.elements[elementIndex].field, result.data);
              fieldsRef.current[question.elements[elementIndex].field] = result.data;
            }
            if (result?.next) goNext();
          } catch (err) {
            setError(err?.message || 'The Page Rule element failed');
          }
        };
      }
    }
    return React.createElement(node.type || 'div', props, ...children);
  };

  // ── standard element renderers ─────────────────────────────────────────────
  const renderElement = (el, index) => {
    const value = values[el.field];
    switch (el.type) {
      case 'toggle':
        return (
          <Box key={el.field || index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Switch checked={value === true} onChange={(e) => setValue(el.field, e.target.checked)} />
            <Typography>{el.placeholder || el.field}</Typography>
          </Box>
        );
      case 'select': {
        const options = Array.isArray(el.options) ? el.options : dbOptions[el.options] || [];
        const byValue = (v) => options.find((o) => o.value === v) || (v ? { label: String(v), value: v } : null);
        return (
          <Autocomplete
            key={el.field || index}
            multiple={el.multiple === true}
            freeSolo={el.creatable === true}
            disableClearable={el.isClearable === false}
            options={options}
            getOptionLabel={(o) => (typeof o === 'string' ? o : o?.label || '')}
            isOptionEqualToValue={(o, v) => o?.value === (v?.value ?? v)}
            value={el.multiple ? (value || []).map(byValue).filter(Boolean) : byValue(value)}
            onChange={(e, next) => {
              const pick = (o) => (typeof o === 'string' ? o : o?.value);
              setValue(el.field, el.multiple ? (next || []).map(pick) : pick(next));
            }}
            renderInput={(params) => <TextField {...params} label={el.placeholder || el.field} />}
          />
        );
      }
      case 'calendar':
        return (
          <Box key={el.field || index} sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              type={el.time ? 'datetime-local' : 'date'}
              label={el.placeholder || el.field}
              InputLabelProps={{ shrink: true }}
              value={el.end ? value?.start || '' : value || ''}
              onChange={(e) => setValue(el.field, el.end ? { ...(value || {}), start: e.target.value } : e.target.value)}
            />
            {el.end && (
              <TextField
                fullWidth
                type={el.time ? 'datetime-local' : 'date'}
                label="End"
                InputLabelProps={{ shrink: true }}
                value={value?.end || ''}
                onChange={(e) => setValue(el.field, { ...(value || {}), end: e.target.value })}
              />
            )}
          </Box>
        );
      case 'custom':
        return <Box key={el.field || index}>{renderCustom(el.customElement, index)}</Box>;
      case 'number':
      case 'currency':
      case 'percentage':
        return (
          <TextField
            key={el.field || index}
            fullWidth
            type="number"
            label={el.placeholder || el.field}
            value={value ?? ''}
            onChange={(e) => setValue(el.field, e.target.value === '' ? '' : Number(e.target.value))}
            InputProps={{
              startAdornment: el.type === 'currency' ? <InputAdornment position="start">$</InputAdornment> : undefined,
              endAdornment: el.type === 'percentage' ? <InputAdornment position="end">%</InputAdornment> : undefined,
            }}
          />
        );
      default:
        return (
          <TextField
            key={el.field || index}
            fullWidth
            label={el.placeholder || el.field}
            value={value ?? ''}
            onChange={(e) => setValue(el.field, e.target.value)}
          />
        );
    }
  };

  if (loading && !question) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto' }}>
      {question?.title && (
        <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#000', mb: 1 }}>{question.title}</Typography>
      )}
      <Typography sx={{ fontSize: 18, color: '#313439', mb: 3 }}>{question?.question}</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {(question?.elements || []).map(renderElement)}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 4 }}>
        <Button disableRipple onClick={goBack} sx={{ textTransform: 'none' }}>
          {questionIndexRef.current === 0 ? 'Cancel' : 'Back'}
        </Button>
        <Typography sx={{ fontSize: 13, color: '#676b72' }}>
          {Number(question?.questionsLeft) > 0 ? `${question.questionsLeft} question${question.questionsLeft === 1 ? '' : 's'} left` : 'Last question'}
        </Typography>
        <Button
          variant="contained" disableElevation disableRipple onClick={goNext} disabled={loading}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 3, backgroundColor: '#5ebbeb', '&:hover': { backgroundColor: '#7ecbf2' } }}
        >
          {(question?.questionsLeft ?? 1) <= 0 ? 'Finish' : 'Next'}
        </Button>
      </Box>
    </Box>
  );
};

export default PageRuleWizard;
