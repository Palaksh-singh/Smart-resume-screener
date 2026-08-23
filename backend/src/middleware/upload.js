import multer from 'multer';

const ALLOWED_MIME = new Set(['application/pdf', 'text/plain']);

const storage = multer.memoryStorage();

export const uploadResume = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const isAllowed =
      ALLOWED_MIME.has(file.mimetype) ||
      file.originalname.toLowerCase().endsWith('.pdf') ||
      file.originalname.toLowerCase().endsWith('.txt');
    if (!isAllowed) {
      return cb(new Error('Only PDF or plain text resumes are supported.'));
    }
    cb(null, true);
  },
});
