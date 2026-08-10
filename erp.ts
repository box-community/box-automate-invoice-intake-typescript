// erp.ts

/**
 * Build (and optionally send) an ERP payload from extracted fields.
 * Replace the commented fetch with your ERP's API endpoint when ready.
 */
export function pushToErp(extracted: Record<string, unknown>, fileId: string) {
  const erpPayload = {
    vendor: extracted['vendorName'],
    invoice_number: extracted['invoiceNumber'],
    total: extracted['totalAmount'],
    currency: extracted['currency'],
    due_date: extracted['dueDate'],
    source_file_id: fileId,
  };
  // Replace with your ERP's API endpoint
  // await fetch('https://erp.example.com/api/invoices', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(erpPayload),
  // });
  console.log('ERP payload ready:', erpPayload);
  return erpPayload;
}
