import React, { useEffect, useState } from 'react';
import { Box, Button, Dialog } from '@mui/material';
import SaleDetailCard from './SaleDetailCard';

// Reference "Modify Details": the SAME expanded sale card, in a frameless
// dialog, with the editing message on top, an editable sale date, one payment
// method select per payment row and a Cancel / Save rail. Nothing else on the
// sale can be changed from here — inventory is deliberately untouched.
const toLocalInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19);
};

const railButtonSx = {
  width: '100%',
  height: 53,
  mb: '8px',
  borderRadius: 0,
  fontSize: 16,
  fontWeight: 400,
  textTransform: 'none',
  boxShadow: 'none',
  bgcolor: '#f8f8f8',
  color: '#313439',
  border: '1px solid #313439',
  '&:hover': { boxShadow: 'none', bgcolor: '#313439', color: '#f8f8f8' },
};

const EditSaleDetailsDialog = ({ open, onClose, sale, onSave, paymentMethods = [] }) => {
  const [saleDate, setSaleDate] = useState('');
  const [methods, setMethods] = useState([]);

  useEffect(() => {
    if (!open || !sale) return;
    setSaleDate(toLocalInput(sale.saleDate));
    setMethods(
      (sale.payments?.length ? sale.payments : [{ paymentMethod: sale.paymentMethod }]).map(
        (p) => p.paymentMethod || ''
      )
    );
  }, [open, sale]);

  if (!sale) return null;

  const handleSave = () => {
    if (!onSave) return;
    onSave({
      saleDate: saleDate ? new Date(saleDate).toISOString() : null,
      // The header method follows the first payment row; the rows themselves are
      // updated by id so a split payment keeps its own methods.
      paymentMethod: methods[0] || sale.paymentMethod,
      payments: (sale.payments || [])
        .map((p, i) => ({ id: p.id, paymentMethod: methods[i] }))
        .filter((p, i) => p.id && p.paymentMethod && p.paymentMethod !== sale.payments[i].paymentMethod),
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{
        elevation: 0,
        sx: {
          borderRadius: 0,
          width: 910,
          maxWidth: '95vw',
          m: 0,
          bgcolor: '#f8f8f8',
          boxShadow: '0 0 30px rgba(0,0,0,.25),0 15px 30px rgba(0,0,0,.2)',
        },
      }}
    >
      <SaleDetailCard
        sale={sale}
        editing
        formatDate={() => ''}
        formatTime={() => ''}
        actionsWidth={176}
        dateValue={saleDate}
        onDateChange={setSaleDate}
        paymentValues={methods}
        onPaymentChange={(idx, value) =>
          setMethods((prev) => prev.map((m, i) => (i === idx ? value : m)))
        }
        paymentMethods={paymentMethods}
        message={
          <>
            Modifying the sale details may result in changes to your current register
            payment method balance.
            <br />
            Modifying the sale will <strong>NOT</strong> change your inventory levels.
          </>
        }
        actions={
          <>
            <Button disableElevation onClick={onClose} sx={railButtonSx}>
              Cancel
            </Button>
            <Button disableElevation onClick={handleSave} sx={railButtonSx}>
              Save
            </Button>
          </>
        }
      />
    </Dialog>
  );
};

export default EditSaleDetailsDialog;
