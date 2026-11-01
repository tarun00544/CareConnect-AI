const { v4: uuidv4 } = require('uuid');

// Generates a structured receipt object for either an appointment payment
// or a medicine order payment. Kept provider-agnostic so it can later be
// piped into a PDF generator without changing callers.
function generateReceipt({ type, referenceId, patient, amount, currency, status, transactionId, date }) {
  return {
    receiptId: `RCPT-${uuidv4().split('-')[0].toUpperCase()}`,
    transactionId,
    type, // 'APPOINTMENT' | 'ORDER'
    referenceId,
    patient: {
      id: patient.id,
      name: patient.name,
    },
    amount,
    currency: currency || 'INR',
    paymentStatus: status,
    date: date || new Date(),
  };
}

module.exports = { generateReceipt };
