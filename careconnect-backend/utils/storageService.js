const path = require('path');
const fs = require('fs/promises');

// Cloud/object storage abstraction. Local-disk implementation for
// development; swap `driver` for an S3/GCS-backed implementation in
// production without changing any calling code (controllers/services
// only depend on this interface: save/getUrl/delete).
class LocalDiskStorageDriver {
  async save(file) {
    // multer has already written the file to disk (see middleware/upload.js);
    // we just record its relative path.
    const relativePath = path.relative(path.join(__dirname, '..', 'uploads'), file.path);
    return { key: relativePath, url: `/uploads/${relativePath.split(path.sep).join('/')}` };
  }

  getUrl(key) {
    return `/uploads/${key.split(path.sep).join('/')}`;
  }

  async delete(key) {
    const fullPath = path.join(__dirname, '..', 'uploads', key);
    try {
      await fs.unlink(fullPath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
}

// To move to S3/GCS: implement the same three methods against the
// respective SDK and export that instance instead.
const driver = new LocalDiskStorageDriver();

module.exports = driver;
