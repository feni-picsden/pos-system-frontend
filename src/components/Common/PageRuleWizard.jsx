import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  CircularProgress,
  Autocomplete,
  InputAdornment,
  Checkbox,
} from '@mui/material';
import {
  RadioButtonChecked,
  RadioButtonUnchecked,
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import ShopfrontSwitch from './ShopfrontSwitch';
import { useAppDialogs } from './AppDialogProvider';
import { SEARCHED_DATABASES } from '../../utils/pageRuleDatabases';

// Renders a custom Page Rule's questions (Setup > Page Rules; reference art.
// 360021629152) in the reference creation-wizard chrome: full-screen gradient,
// dot rail + CANCEL on top, title, question, white fields, PREVIOUS / SKIP /
// NEXT (FINISH) footer. The rule itself runs in the sandbox
// (utils/pageRuleSandbox); this component drives the ask/answer loop.
//
// props:
//   session   — a createPageRuleSession() result
//   user      — { name, username, role, permissions } for the rule context
//   location  — { outlet, register } for the rule context
//   dbFetch   — async (databaseName, search) => [{ label, value }] for select elements
//   onFinish  — (fields, answers) => void; fields = { field: value } accumulated
//   onSkip    — (fields, answers) => void; leave the wizard for the full form now
//   onCancel  — () => void

const GRADIENT = 'linear-gradient(to bottom right,#5da2ba,#2193b0,#283c86,#4bc0c8,#283c86,#2193b0)';
const NEAR_WHITE = '#f8f8f8';
const INVALID = 'rgba(248,248,248,0.55)';
const MIN_SEARCH = 3;

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: '#fff',
    borderRadius: '6px',
    minHeight: 52,
    fontSize: 18,
    '& fieldset': { borderColor: '#404040', borderWidth: 1 },
    '&:hover fieldset': { borderColor: '#000' },
    '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: 2 },
  },
  '& input::placeholder': { color: '#6b6b6b', opacity: 1 },
};

// Dotted field names ("prices.0.price", "emails.0") set nested values.
const setPath = (target, path, value) => {
  const parts = String(path).split('.');
  let cur = target;
  parts.forEach((part, i) => {
    if (i === parts.length - 1) { cur[part] = value; return; }
    if (cur[part] == null || typeof cur[part] !== 'object') cur[part] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    cur = cur[part];
  });
  return target;
};

const styleOf = (attrs) => {
  const style = attrs?.style;
  return style && typeof style === 'object' ? style : undefined;
};

const PageRuleWizard = ({ session, user, location, dbFetch, onFinish, onSkip, onCancel }) => {
  const { notify, alert } = useAppDialogs();
  const [question, setQuestion] = useState(null);
  const [values, setValues] = useState({});
  const [dbOptions, setDbOptions] = useState({}); // key -> options
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const answersRef = useRef([]); // [{question, elements:[{field,value}], metaData}]
  const fieldsRef = useRef({}); // accumulated field -> value (answers + setField)
  const questionIndexRef = useRef(0);
  const finishedRef = useRef(false);
  const searchSeq = useRef(0);

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

  // Field values as the callers read them: nested objects for dotted names.
  const collectFields = () => {
    const out = {};
    Object.entries(fieldsRef.current).forEach(([k, v]) => setPath(out, k, v));
    return out;
  };

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish(collectFields(), answersRef.current);
  };

  const sourcesOf = (el) => {
    const src = el.dataSource ?? el.options;
    if (typeof src === 'string') return [src];
    if (Array.isArray(src) && src.every((s) => typeof s === 'string')) return src;
    return [];
  };
  const dbKey = (el) => sourcesOf(el).join('+');
  const isSearched = (el) => sourcesOf(el).some((s) => SEARCHED_DATABASES.includes(s));

  const loadOptions = async (el, search) => {
    const names = sourcesOf(el);
    const lists = await Promise.all(names.map(async (name) => {
      try { return (await dbFetch(name, search)).map((o) => ({ ...o, group: names.length > 1 ? name : undefined })); } catch { return []; }
    }));
    return lists.flat();
  };

  const askCurrent = async () => {
    try {
      setLoading(true);
      setError('');
      const q = await session.ask(buildContext());
      const loads = {};
      for (const el of q.elements || []) {
        if (el.type === 'select' && sourcesOf(el).length && !isSearched(el)) loads[dbKey(el)] = await loadOptions(el, '');
      }
      setDbOptions(loads);
      const seeded = {};
      for (const el of q.elements || []) {
        if (el.field) {
          const d = el.default;
          seeded[el.field] = d !== undefined && d !== null ? d : (el.type === 'toggle' ? false : el.multiple ? [] : '');
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

  useEffect(() => {
    askCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Host actions raised by the rule via ShopfrontAPI.
  useEffect(() => {
    if (!session) return undefined;
    session.hostActionHandler = (action, payload) => {
      switch (action) {
        case 'toast': {
          const kind = payload.toastType === 'information' || payload.toastType === 'info' ? 'info' : payload.toastType;
          if (kind === 'success' || kind === 'info') notify(payload.toastMessage, kind, { position: 'top' });
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
  }, [session, question, values]);

  const recordAnswer = () => {
    const elements = (question?.elements || [])
      .filter((el) => el.field)
      .map((el) => ({ field: el.field, value: values[el.field] }));
    elements.forEach((el) => { fieldsRef.current[el.field] = el.value; });
    answersRef.current = [
      ...answersRef.current.slice(0, questionIndexRef.current),
      { question: question?.question || '', elements, metaData: question?.metaData },
    ];
  };

  const isEmpty = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
  const requiredOk = () => (question?.elements || []).every((el) => !(el.required && el.field) || !isEmpty(values[el.field]));

  const goNext = () => {
    if (loading) return;
    if (!requiredOk()) {
      const missing = (question?.elements || []).find((el) => el.required && el.field && isEmpty(values[el.field]));
      setError(`"${missing?.printName || missing?.placeholder || missing?.field}" is required`);
      return;
    }
    recordAnswer();
    if ((question?.questionsLeft ?? 1) <= 0) { finish(); return; }
    questionIndexRef.current += 1;
    askCurrent();
  };

  // PREVIOUS keeps the later answers in context (the rule reads its defaults
  // from them, so the values stay filled); NEXT re-records from that index on.
  const goBack = () => {
    if (questionIndexRef.current === 0) { onCancel?.(); return; }
    questionIndexRef.current -= 1;
    askCurrent();
  };

  // SKIP (reference): leave the wizard now, carrying what was answered so far.
  const skip = () => {
    if (loading) return;
    if (question?.elements?.length) {
      (question.elements || []).filter((el) => el.field && !isEmpty(values[el.field])).forEach((el) => { fieldsRef.current[el.field] = values[el.field]; });
    }
    if (finishedRef.current) return;
    finishedRef.current = true;
    (onSkip || onFinish)(collectFields(), answersRef.current);
  };

  const setValue = (field, value) => setValues((prev) => ({ ...prev, [field]: value }));

  // ── custom element renderer ─────────────────────────────────────────────────
  const renderCustom = (node, elementIndex, path = String(elementIndex), isRoot = true) => {
    if (!node) return null;
    const children = [
      node.textNode,
      ...(node.children || []).map((child, i) => renderCustom(child, elementIndex, `${path}.${i}`, false)),
    ].filter((c) => c !== undefined && c !== null);
    const attrs = { ...(node.attributes || {}) };
    const props = { key: path };
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'style') props.style = styleOf(attrs);
      else if (k === 'class') props.className = v;
      else if (k === 'autoFocus') props.autoFocus = Boolean(v);
      else props[k] = v;
    });
    // Reference: an event on any node bubbles to the first parent's onEvent
    // with that node as currentTarget (dataset + value available to the rule).
    const rootHasHandler = question?.elements?.[elementIndex]?.customElement?.hasOnEvent;
    for (const eventName of node.events || []) {
      const reactEvent = eventName === 'change' ? 'onChange' : eventName === 'click' ? 'onClick' : null;
      if (!reactEvent || !rootHasHandler) continue;
      props[reactEvent] = async (e) => {
        e.stopPropagation?.();
        const ds = {};
        Object.entries(attrs).forEach(([k, v]) => { if (k.startsWith('data-')) ds[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v; });
        try {
          const result = await session.fireEvent(question.askId, String(elementIndex), {
            type: eventName,
            value: e?.target?.value ?? null,
            dataset: ds,
          });
          const field = question.elements[elementIndex]?.field;
          if (result && field !== undefined) {
            setValue(field, result.data);
            fieldsRef.current[field] = result.data;
            if (result.next) {
              // Commit this answer with the handler's data before moving on.
              const elements = (question.elements || []).filter((el) => el.field).map((el) => ({ field: el.field, value: el.field === field ? result.data : values[el.field] }));
              answersRef.current = [...answersRef.current.slice(0, questionIndexRef.current), { question: question.question || '', elements, metaData: question.metaData }];
              if ((question.questionsLeft ?? 1) <= 0) { finish(); return; }
              questionIndexRef.current += 1;
              askCurrent();
            }
          } else if (result?.next) {
            goNext();
          }
        } catch (err) {
          setError(err?.message || 'The Page Rule element failed');
        }
      };
    }
    if (isRoot && !props.style) props.style = undefined;
    return React.createElement(node.type || 'div', props, ...children);
  };

  // ── standard element renderers ─────────────────────────────────────────────
  const renderElement = (el, index) => {
    const value = values[el.field];
    const label = el.placeholder || '';
    switch (el.type) {
      case 'toggle':
        return (
          <Box key={el.field || index} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ShopfrontSwitch checked={value === true} onChange={(e) => setValue(el.field, e.target.checked)} inputProps={{ 'aria-label': label || el.field }} />
            <Typography sx={{ fontSize: 18, color: NEAR_WHITE }}>{label || el.field}</Typography>
          </Box>
        );
      case 'select': {
        const key = dbKey(el);
        const options = Array.isArray(el.options) && typeof el.options[0] !== 'string' ? el.options : dbOptions[key] || [];
        const byValue = (v) => {
          if (v && typeof v === 'object' && 'value' in v) return v;
          const found = options.find((o) => o.value === v || o.value === String(v));
          if (found) return found;
          if (v === null || v === undefined || v === '') return null;
          return { label: el.__label || String(v), value: v };
        };
        const searched = isSearched(el);
        return (
          <Autocomplete
            key={el.field || index}
            multiple={el.multiple === true}
            freeSolo={el.creatable === true}
            disableClearable={el.isClearable === false}
            options={options}
            groupBy={options.some((o) => o.group) ? (o) => o.group : undefined}
            getOptionLabel={(o) => (typeof o === 'string' ? o : o?.label || '')}
            isOptionEqualToValue={(o, v) => String(o?.value) === String(v?.value ?? v)}
            value={el.multiple ? (Array.isArray(value) ? value : []).map(byValue).filter(Boolean) : byValue(value)}
            onChange={(e, next) => {
              const pick = (o) => (typeof o === 'string' ? { label: o, value: o, __new: true } : o);
              setValue(el.field, el.multiple ? (next || []).map(pick) : (next ? pick(next) : null));
            }}
            onInputChange={async (e, text, reason) => {
              if (!searched || reason !== 'input') return;
              if (String(text).trim().length < MIN_SEARCH) { setDbOptions((p) => ({ ...p, [key]: [] })); return; }
              const seq = ++searchSeq.current;
              const list = await loadOptions(el, text.trim());
              if (seq === searchSeq.current) setDbOptions((p) => ({ ...p, [key]: list }));
            }}
            noOptionsText={searched ? 'Keep Typing to Search...' : 'No Options'}
            renderOption={el.multiple ? (props, option, { selected }) => (
              <li {...props}><Checkbox size="small" checked={selected} sx={{ mr: 1 }} />{option.label}</li>
            ) : undefined}
            renderInput={(params) => <TextField {...params} placeholder={label} inputProps={{ ...params.inputProps, 'aria-label': label || el.field }} sx={fieldSx} />}
          />
        );
      }
      case 'calendar':
        return (
          <TextField
            key={el.field || index}
            fullWidth
            type={el.time ? 'datetime-local' : 'date'}
            value={value || ''}
            onChange={(e) => setValue(el.field, e.target.value)}
            inputProps={{ 'aria-label': label || el.field }}
            helperText={label}
            FormHelperTextProps={{ sx: { color: NEAR_WHITE, fontSize: 14, ml: 0 } }}
            sx={fieldSx}
          />
        );
      case 'custom':
        return <Box key={el.field || index} sx={{ color: NEAR_WHITE }}>{renderCustom(el.customElement, index)}</Box>;
      case 'number':
      case 'currency':
      case 'percentage':
        return (
          <TextField
            key={el.field || index}
            fullWidth
            type="number"
            placeholder={label}
            value={value ?? ''}
            onChange={(e) => setValue(el.field, e.target.value === '' ? '' : Number(e.target.value))}
            inputProps={{ 'aria-label': label || el.field, step: el.step ?? 'any', min: el.min, max: el.max }}
            InputProps={{
              startAdornment: el.type === 'currency' ? <InputAdornment position="start">$</InputAdornment> : undefined,
              endAdornment: el.type === 'percentage' ? <InputAdornment position="end">%</InputAdornment> : undefined,
            }}
            sx={fieldSx}
          />
        );
      default:
        return (
          <TextField
            key={el.field || index}
            fullWidth
            autoFocus={index === 0}
            placeholder={label}
            value={value ?? ''}
            onChange={(e) => setValue(el.field, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') goNext(); }}
            inputProps={{ 'aria-label': label || el.field }}
            sx={fieldSx}
          />
        );
    }
  };

  const index = questionIndexRef.current;
  const left = Number(question?.questionsLeft) > 0 ? Number(question.questionsLeft) : 0;
  const totalDots = index + left + 1;
  const isLast = left <= 0;
  const valid = !loading && requiredOk();

  const controlSx = (align, fontSize) => ({
    display: 'flex', alignItems: 'center', justifyContent: align, gap: '0.5rem', fontSize, fontWeight: 400,
    color: NEAR_WHITE, cursor: 'pointer', userSelect: 'none', textTransform: 'uppercase',
  });
  const columnSx = { width: '100%', maxWidth: 900, mx: 'auto', padding: '1rem' };

  return (
    <Box
      data-testid="page-rule-wizard"
      sx={{
        position: 'fixed', inset: 0, zIndex: 1300,
        display: 'grid', gridTemplateRows: '71px 60px 1fr 60px', overflow: 'hidden',
        color: NEAR_WHITE, background: `${GRADIENT} 0 0/1400% 1400%`,
        '@keyframes cwBgChange': { '0%': { backgroundPosition: '0 0' }, '50%': { backgroundPosition: '100% 100%' }, '100%': { backgroundPosition: '0 0' } },
        animation: 'cwBgChange 300s linear infinite',
      }}
    >
      {/* Top: dot rail + cancel */}
      <Box sx={{ ...columnSx, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <Box sx={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', fontSize: 16 }} data-testid="wizard-dots">
          {Array.from({ length: totalDots }).map((_, idx) => {
            const Dot = idx === index ? RadioButtonChecked : RadioButtonUnchecked;
            return (
              <Box key={idx} sx={{ width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Dot sx={{ fontSize: idx === index ? '1.3em' : '1em' }} />
              </Box>
            );
          })}
        </Box>
        <Box onClick={onCancel} sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 19.2, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}>
          <CloseIcon sx={{ fontSize: 19.2 }} />
          Cancel
        </Box>
      </Box>

      {/* Title */}
      <Box sx={{ textAlign: 'center', padding: '0.5rem', paddingTop: '12px' }}>
        <Typography component="p" sx={{ fontSize: 20.8, color: NEAR_WHITE }}>{question?.title || ''}</Typography>
      </Box>

      {/* Question + elements */}
      <Box sx={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'safe center', pb: '104px' }}>
        <Box sx={{ ...columnSx, flexShrink: 0 }}>
          {loading && !question ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress sx={{ color: NEAR_WHITE }} /></Box>
          ) : (
            <>
              <Typography sx={{ fontSize: 32, fontWeight: 400, color: NEAR_WHITE, mb: 1.5 }}>{question?.question}</Typography>
              {error && <Typography sx={{ color: '#ffd1d1', mb: 1.5 }} role="alert">{error}</Typography>}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, opacity: loading ? 0.6 : 1 }}>
                {(question?.elements || []).map(renderElement)}
              </Box>
            </>
          )}
        </Box>
      </Box>

      {/* Controls */}
      <Box sx={{ ...columnSx, display: 'grid', gridTemplateColumns: '1fr 60px 1fr', alignItems: 'center' }}>
        {index > 0 ? (
          <Box onClick={goBack} sx={controlSx('flex-start', 21.12)}><ArrowBackIcon sx={{ fontSize: 21.12 }} />Previous</Box>
        ) : <Box />}
        <Box onClick={skip} sx={controlSx('center', 17.6)}>Skip</Box>
        <Box onClick={goNext} sx={{ ...controlSx('flex-end', 21.12), color: valid ? NEAR_WHITE : INVALID, cursor: valid ? 'pointer' : 'not-allowed' }}>
          {isLast ? 'Finish' : 'Next'}
          {isLast ? <CheckIcon sx={{ fontSize: 21.12 }} /> : <ArrowForwardIcon sx={{ fontSize: 21.12 }} />}
        </Box>
      </Box>
    </Box>
  );
};

export default PageRuleWizard;
