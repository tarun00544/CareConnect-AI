import Modal from './Modal';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'primary', onConfirm, onCancel }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </>
      }
    >
      <p className="muted">{message}</p>
    </Modal>
  );
}
