const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

function destinationFor(subfolder) {
  return path.join(__dirname, '..', 'uploads', subfolder);
}

function makeStorage(subfolder) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, destinationFor(subfolder)),
    filename: (req, file, cb) => {
      const safeExt = path.extname(file.originalname).toLowerCase();
      const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`;
      cb(null, uniqueName);
    },
  });
}

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`));
  }
  cb(null, true);
}

function buildUploader(subfolder) {
  return multer({
    storage: makeStorage(subfolder),
    fileFilter,
    limits: { fileSize: env.uploads.maxMb * 1024 * 1024, files: 5 },
  });
}

// ---- Private professional documents ----------------------------------------
// Stored OUTSIDE the publicly served /uploads tree and only ever streamed through an
// authenticated, role-checked route (see controllers/doctorAdminController.js).
const fs = require('fs');
const PRIVATE_DOC_DIR = path.join(__dirname, '..', 'private_uploads', 'doctor-documents');
const DOC_MIME_EXT = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' };

const uploadDoctorDocument = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(PRIVATE_DOC_DIR, { recursive: true });
      cb(null, PRIVATE_DOC_DIR);
    },
    // Extension is derived from the validated MIME type, never from the client filename.
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${DOC_MIME_EXT[file.mimetype] || ''}`),
  }),
  fileFilter: (req, file, cb) => {
    if (!DOC_MIME_EXT[file.mimetype]) return cb(ApiError.badRequest('Only PDF, JPEG or PNG documents are allowed'));
    cb(null, true);
  },
  limits: { fileSize: env.uploads.maxMb * 1024 * 1024, files: 1 },
});

module.exports = {
  PRIVATE_DOC_DIR,
  uploadDoctorDocument,
  uploadReport: buildUploader('reports'),
  uploadPrescription: buildUploader('prescriptions'),
  uploadAdmissionDoc: buildUploader('admissions'),
  uploadProfileImage: buildUploader('profiles'),
};
