import React, { useState, useEffect, useRef } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Autocomplete,
  Checkbox,
  IconButton,
  Alert,
  Snackbar,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { Add as AddIcon, DeleteOutline } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import productService from '../../services/productService';

const steps = [
  { label: 'Barcode' },
  { label: 'Product Name' },
  { label: 'Category' },
  { label: 'Tags' },
  { label: 'Case Quantity' },
  { label: 'Pricing' },
];

// Parity-system field styling: notchedOutline #404040 1px (hover same),
// focused #000 2px, radius 8px; placeholder #808080.
const fieldSx = {
  backgroundColor: 'white',
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
  },
  '& input::placeholder': { color: '#808080', opacity: 1 },
};

// Parity-system primary button: bg #5ebbeb, radius 12px, height 42,
// fontWeight 700, fontSize 16, textTransform none, no shadow.
const primaryButtonSx = {
  backgroundColor: '#5ebbeb',
  borderRadius: '12px',
  height: 42,
  fontWeight: 700,
  fontSize: 16,
  textTransform: 'none',
  boxShadow: 'none',
  '&:hover': { backgroundColor: '#4aa9dd', boxShadow: 'none' },
};

// Reference diagonal multi-stop gradient for the full-screen wizard backdrop.
const wizardGradient =
  'linear-gradient(to right bottom, #5da2ba, #2193b0, #283c86, #4bc0c8, #283c86, #2193b0)';

// Reference question heading: 2em (32px) / 400 #f8f8f8, margin 0 0 8px, left-aligned.
const questionSx = {
  fontSize: '32px',
  fontWeight: 400,
  color: '#f8f8f8',
  margin: '0 0 8px',
};

// Reference wizard controls are PLAIN uppercase white text on the gradient —
// no button chrome, no hover feedback (cursor change only), 1.2em = 21.12px.
const controlTextSx = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '10px',
  fontSize: '21.12px',
  fontWeight: 400,
  textTransform: 'uppercase',
  lineHeight: 1,
  color: '#f8f8f8',
  cursor: 'pointer',
  userSelect: 'none',
};

// Thin FontAwesome-light look-alikes (fal fa-times / fal fa-long-arrow-*).
const ThinTimesIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true" focusable="false">
    <path
      d="M1.5 1.5 L13.5 13.5 M13.5 1.5 L1.5 13.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

const LongArrowRightIcon = () => (
  <svg width="24" height="14" viewBox="0 0 24 14" aria-hidden="true" focusable="false">
    <path
      d="M1 7 H22.5 M16.5 1 L22.5 7 L16.5 13"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const LongArrowLeftIcon = () => (
  <svg width="24" height="14" viewBox="0 0 24 14" aria-hidden="true" focusable="false">
    <path
      d="M23 7 H1.5 M7.5 1 L1.5 7 L7.5 13"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const CreateProductWizard = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // Message set when NEXT is pressed on an invalid step, shown as a toast + helper text.
  const [stepError, setStepError] = useState('');
  // Directional page transition: { from, direction } while a slide is playing.
  const [transition, setTransition] = useState(null);
  const transitionTimerRef = useRef(null);
  const handleNextRef = useRef(null);

  // Form data
  const [formData, setFormData] = useState({
    barcode: '',
    name: '',
    categoryId: null,
    tags: [],
    // Number fields hold the RAW input string while typing — coercing inside onChange
    // rewrites intermediate keystrokes ('' -> 1) and appends the next digit instead of
    // replacing it. Coerced once, in handleSave.
    // Ref: no silent default — skipping the case-quantity step leaves it empty and
    // the editor's required-field validation catches it at save.
    caseQuantity: '',
    prices: [{ quantity: '1', price: '0' }],
  });

  // Available options
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);

  useEffect(() => {
    loadOptions();
    return () => clearTimeout(transitionTimerRef.current);
  }, []);

  const loadOptions = async () => {
    try {
      setLoading(true);
      // Load categories and tags from classifications
      const [categoriesResponse, tagsResponse] = await Promise.all([
        productService.getCategories(),
        productService.getTags(),
      ]);

      setCategories(Array.isArray(categoriesResponse) ? categoriesResponse : []);
      setTags(Array.isArray(tagsResponse) ? tagsResponse : []);
    } catch (error) {
      console.error('Error loading options:', error);
      // Fallback to mock data
      setCategories([
        { id: 1, name: 'Pre Mix / RTDs' },
        { id: 2, name: 'Wine' },
        { id: 3, name: 'Spirits' },
        { id: 4, name: 'Beer' },
        { id: 5, name: 'Non-Alcoholic' },
      ]);
      setTags([
        { id: 1, name: 'Popular' },
        { id: 2, name: 'New Arrival' },
        { id: 3, name: 'Sale' },
        { id: 4, name: 'Organic' },
        { id: 5, name: 'Premium' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Directional navigation with the reference slide-in/slide-out page animation.
  const goToStep = (target) => {
    if (saving) return;
    if (target === activeStep || target < 0 || target > steps.length - 1) return;
    const direction = target > activeStep ? 'forward' : 'backward';
    setStepError('');
    setTransition({ from: activeStep, direction });
    setActiveStep(target);
    clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = setTimeout(() => setTransition(null), 320);
  };

  // Message for the step that is currently blocking NEXT ('' when the step is valid).
  const stepErrorFor = (step) => {
    if (step === 1 && formData.name.trim() === '') return 'Name is required';
    if (step === 4 && !(Number(formData.caseQuantity) >= 1))
      return 'Case Quantity must be greater than or equal to 1';
    return '';
  };

  const isStepValid = () => stepErrorFor(activeStep) === '';

  const handleNext = () => {
    if (loading || saving) return;
    // A blocked NEXT has to say why — silently doing nothing leaves the user stuck.
    const message = stepErrorFor(activeStep);
    if (message) {
      setStepError(message);
      return;
    }
    setStepError('');
    if (activeStep === steps.length - 1) {
      handleSave();
    } else {
      goToStep(activeStep + 1);
    }
  };

  const handleBack = () => {
    goToStep(activeStep - 1);
  };

  // Reference: SKIP exits the wizard from ANY step and opens the full product form
  // pre-filled with whatever was entered so far.
  const handleSkip = () => {
    if (saving) return;
    handleSave();
  };

  const handleCancel = () => {
    navigate('/products');
  };

  // Enter key navigates to the next page (reference wizard behavior).
  useEffect(() => {
    handleNextRef.current = handleNext;
  });

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Enter') return;
      const target = event.target;
      // Let selects/menus handle Enter themselves.
      if (
        target &&
        target.closest &&
        target.closest('[role="listbox"], [role="option"], [role="combobox"]')
      ) {
        return;
      }
      if (handleNextRef.current) handleNextRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);

      // Save wizard data to localStorage for the product details page
      const wizardData = {
        barcode: formData.barcode,
        name: formData.name,
        categoryId: formData.categoryId,
        tags: formData.tags,
        caseQuantity: formData.caseQuantity === ''
          ? ''
          : Math.max(1, parseInt(formData.caseQuantity, 10) || 1),
        prices: formData.prices.map((p) => ({
          quantity: Math.max(1, parseInt(p.quantity, 10) || 1),
          price: parseFloat(p.price) || 0,
        })),
        // Add default values for required fields
        type: 'Normal Product',
        status: 'Active',
        description: '',
        retailTaxRate: 'GST',
        purchaseTaxRate: 'Inherit',
        sellOnShopMyLocal: false,
        trackInventory: true,
        currentStockCases: 0,
        currentStockItems: 0,
        reorderLevelCases: 0,
        reorderLevelItems: 0,
        reorderAmountCases: 0,
        reorderAmountItems: 0,
        caseCost: 0,
        itemCost: 0,
        preventManualDiscounts: false,
        costPercentage: false,
        showCostsIncludingTax: true,
        requestPrice: false,
        requestQuantity: false,
        reorderRounding: 'No Rounding',
        barcodes: formData.barcode ? [formData.barcode] : [],
        orderNotes: '',
        invoiceNotes: '',
        tagIds: formData.tags,
        supplierIds: [],
        loyaltyRows: [],
        images: []
      };

      localStorage.setItem('productWizardData', JSON.stringify(wizardData));

      // Navigate to product details page for new product
      navigate('/products/new');
    } catch (error) {
      console.error('Error saving wizard data:', error);
      setError('Failed to save wizard data');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePriceChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      prices: prev.prices.map((price, i) =>
        i === index ? { ...price, [field]: value } : price
      )
    }));
  };

  const addPriceRow = () => {
    setFormData(prev => ({
      ...prev,
      prices: [...prev.prices, { quantity: '1', price: '0' }]
    }));
  };

  const removePriceRow = (index) => {
    setFormData(prev => ({
      ...prev,
      prices: prev.prices.filter((_, i) => i !== index)
    }));
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography sx={questionSx}>
              What is the barcode for the product?
            </Typography>
            <TextField
              fullWidth
              value={formData.barcode}
              onChange={(e) => handleInputChange('barcode', e.target.value)}
              sx={fieldSx}
            />
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography sx={questionSx}>
              What is the name of this product?
            </Typography>
            <TextField
              fullWidth
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              sx={fieldSx}
              required
              error={Boolean(stepError) && !formData.name.trim()}
              helperText={Boolean(stepError) && !formData.name.trim() ? 'Name is required' : ''}
            />
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography sx={questionSx}>
              What category does {formData.name || 'a'} belong to?
            </Typography>
            <Autocomplete
              fullWidth
              options={categories}
              getOptionLabel={(option) => option.name || ''}
              value={categories.find((c) => c.id === formData.categoryId) || null}
              onChange={(_, newValue) =>
                handleInputChange('categoryId', newValue ? newValue.id : null)
              }
              isOptionEqualToValue={(option, val) => option.id === val.id}
              renderInput={(params) => (
                <TextField {...params} placeholder="Select..." sx={fieldSx} />
              )}
            />
          </Box>
        );

      case 3:
        return (
          <Box>
            <Typography sx={questionSx}>
              What tags does {formData.name || 'a'} have?
            </Typography>
            <Autocomplete
              multiple
              disableCloseOnSelect
              fullWidth
              options={tags}
              getOptionLabel={(option) => option.name || ''}
              value={tags.filter((t) => formData.tags.includes(t.id))}
              onChange={(_, newValue) =>
                handleInputChange('tags', newValue.map((t) => t.id))
              }
              isOptionEqualToValue={(option, val) => option.id === val.id}
              // Checkbox rows, list stays open until Escape — the project's standard
              // multi-select recipe (see Utilities/ProductUtilities.jsx).
              renderOption={(props, option, { selected }) => {
                const { key, ...optionProps } = props;
                return (
                  <li key={key} {...optionProps}>
                    <Checkbox
                      checked={selected}
                      sx={{ p: 0.5, mr: 1, color: '#000', '&.Mui-checked': { color: '#000' } }}
                    />
                    {option.name || ''}
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField {...params} placeholder="Select..." sx={fieldSx} />
              )}
            />
          </Box>
        );

      case 4:
        return (
          <Box>
            <Typography sx={questionSx}>
              How many {formData.name || 'a'}'s come in a case?
            </Typography>
            <TextField
              fullWidth
              type="number"
              value={formData.caseQuantity}
              // A case holds at least one item — but the typed value is kept raw so
              // clearing the field stays cleared; NEXT is what blocks empty/0/negative.
              inputProps={{ min: 1 }}
              onChange={(e) => handleInputChange('caseQuantity', e.target.value)}
              error={Boolean(stepError) && !isStepValid()}
              helperText={stepError && !isStepValid() ? stepError : ''}
              sx={fieldSx}
            />
          </Box>
        );

      case 5:
        return (
          <Box>
            <Typography sx={questionSx}>
              What prices does {formData.name || 'a'} have?
            </Typography>
            <TableContainer
              component={Paper}
              sx={{ backgroundColor: 'white', borderRadius: 0, boxShadow: 'none' }}
            >
              <Table>
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
                        borderBottom: 'none',
                      },
                    }}
                  >
                    <TableCell>Quantity</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {formData.prices.map((price, index) => (
                    <TableRow
                      key={index}
                      sx={{ bgcolor: index % 2 === 0 ? '#fff' : '#f8f8f8' }}
                    >
                      <TableCell>
                        <TextField
                          type="number"
                          value={price.quantity}
                          onChange={(e) => handlePriceChange(index, 'quantity', e.target.value)}
                          inputProps={{ min: 1 }}
                          size="small"
                          sx={fieldSx}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          value={price.price}
                          onChange={(e) => handlePriceChange(index, 'price', e.target.value)}
                          size="small"
                          sx={fieldSx}
                          InputProps={{
                            startAdornment: '$',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {formData.prices.length > 1 && (
                          <IconButton
                            onClick={() => removePriceRow(index)}
                            size="small"
                            sx={{ color: '#e33430' }}
                          >
                            <DeleteOutline />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={addPriceRow}
              sx={{ mt: 2, ...primaryButtonSx }}
            >
              Add Price Point
            </Button>
            <Typography variant="body2" sx={{ mt: 2, color: 'white' }}>
              You can customise the prices further on the next page.
            </Typography>
          </Box>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  const stepValid = isStepValid();
  const isLastStep = activeStep === steps.length - 1;

  return (
    <Box
      sx={{
        // Viewport-filling grid (rows: top bar / title / pages / controls) so the
        // page never scrolls and the controls stay pinned, like the reference.
        height: 'calc(100vh - 50px)',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateRows: '65px 60px 1fr 60px',
        background: wizardGradient,
        backgroundSize: '1400% 1400%',
        animation: 'basic-background-change 300s linear infinite',
        '@keyframes basic-background-change': {
          '0%': { backgroundPosition: '0px 0px' },
          '50%': { backgroundPosition: '100% 100%' },
          '100%': { backgroundPosition: '0px 0px' },
        },
        '@keyframes creation-wizard-opacity': {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        '@keyframes slide-in-right': {
          from: { transform: 'translateX(200%)', opacity: 0 },
          to: { transform: 'translateX(0)', opacity: 1 },
        },
        '@keyframes slide-out-left': {
          from: { transform: 'translateX(0)', opacity: 1 },
          to: { transform: 'translateX(-200%)', opacity: 0 },
        },
        '@keyframes slide-in-left': {
          from: { transform: 'translateX(-200%)', opacity: 0 },
          to: { transform: 'translateX(0)', opacity: 1 },
        },
        '@keyframes slide-out-right': {
          from: { transform: 'translateX(0)', opacity: 1 },
          to: { transform: 'translateX(200%)', opacity: 0 },
        },
      }}
    >
      {/* Top row: centered 900px grid — step dots in the middle, Cancel at the
          right edge of the content column */}
      <Box
        sx={{
          animation: 'creation-wizard-opacity 0.2s',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            width: 900,
            maxWidth: '100%',
            px: '16px',
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
          }}
        >
          <Box />

          {/* Step progress dots: outline circles, current = ring with center dot,
              hover grows any dot, click jumps to that step */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {steps.map((step, index) => (
              <Box
                key={step.label}
                onClick={() => goToStep(index)}
                sx={{
                  pr: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Box
                  sx={{
                    width: index === activeStep ? '20.8px' : '16px',
                    height: index === activeStep ? '20.8px' : '16px',
                    borderRadius: '50%',
                    border: '1px solid #f8f8f8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'width 0.2s ease, height 0.2s ease',
                    '&:hover': { width: '20.8px', height: '20.8px' },
                  }}
                >
                  {index === activeStep && (
                    <Box
                      sx={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: '#f8f8f8',
                      }}
                    />
                  )}
                </Box>
              </Box>
            ))}
          </Box>

          {/* Cancel: plain text control, no hover feedback */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Box
              onClick={handleCancel}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                color: '#f8f8f8',
                fontSize: '19.2px',
                fontWeight: 400,
                textTransform: 'uppercase',
                lineHeight: 1,
                userSelect: 'none',
              }}
            >
              <ThinTimesIcon />
              Cancel
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Title row */}
      <Box
        sx={{
          animation: 'creation-wizard-opacity 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          component="p"
          sx={{
            color: '#f8f8f8',
            fontSize: '20.8px',
            fontWeight: 400,
            m: 0,
            textAlign: 'center',
          }}
        >
          Create Product
        </Typography>
      </Box>

      {/* Pages row: directional slide transition between steps */}
      <Box
        sx={{
          animation: 'creation-wizard-opacity 0.2s',
          position: 'relative',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {transition && (
          <Box
            key={`out-${transition.from}`}
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <Box
              sx={{
                width: 900,
                maxWidth: '100%',
                px: '16px',
                pt: '16px',
                animation: `${
                  transition.direction === 'forward' ? 'slide-out-left' : 'slide-out-right'
                } 0.3s cubic-bezier(0.55, 0.085, 0.68, 0.53) both`,
              }}
            >
              {renderStepContent(transition.from)}
            </Box>
          </Box>
        )}
        <Box
          key={`in-${activeStep}`}
          sx={{ height: '100%', display: 'flex', justifyContent: 'center' }}
        >
          <Box
            sx={{
              width: 900,
              maxWidth: '100%',
              px: '16px',
              // Reference vertically anchors the question/input in the mid-upper
              // viewport (~150px lower than a top-anchored block).
              pt: 'clamp(48px, 15vh, 180px)',
              animation: transition
                ? `${
                    transition.direction === 'forward' ? 'slide-in-right' : 'slide-in-left'
                  } 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both`
                : 'none',
            }}
          >
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            {renderStepContent(activeStep)}
          </Box>
        </Box>
      </Box>

      {/* Controls row: PREVIOUS left / SKIP center / NEXT-FINISH right */}
      <Box
        sx={{
          animation: 'creation-wizard-opacity 0.2s',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            width: 900,
            maxWidth: '100%',
            px: '16px',
            display: 'grid',
            gridTemplateColumns: '1fr 60px 1fr',
            alignItems: 'center',
          }}
        >
          <Box>
            {activeStep > 0 && (
              <Box onClick={handleBack} sx={controlTextSx}>
                <LongArrowLeftIcon />
                Previous
              </Box>
            )}
          </Box>

          <Box
            onClick={handleSkip}
            sx={{
              justifySelf: 'center',
              fontSize: '17.6px',
              fontWeight: 400,
              textTransform: 'uppercase',
              lineHeight: 1,
              color: '#f8f8f8',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'color 0.2s ease-in-out, opacity 0.2s ease-in-out',
            }}
          >
            Skip
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Box
              onClick={handleNext}
              sx={{
                ...controlTextSx,
                // Invalid state stays visible + hoverable: gray, cursor not-allowed.
                color: stepValid ? '#f8f8f8' : '#bdbdbd',
                opacity: stepValid ? 1 : 0.9,
                cursor: stepValid && !saving ? 'pointer' : 'not-allowed',
                transition: 'color 0.2s, opacity 0.2s ease-in-out',
              }}
            >
              {saving ? (
                <CircularProgress size={20} color="inherit" />
              ) : isLastStep ? (
                'Finish'
              ) : (
                'Next'
              )}
              <LongArrowRightIcon />
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Blocked NEXT / Enter: red toast at the top, matching the reference. */}
      <Snackbar
        open={Boolean(stepError)}
        autoHideDuration={4000}
        onClose={() => setStepError('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setStepError('')}>
          {stepError}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CreateProductWizard;
