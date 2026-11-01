const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticate } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const { assessmentValidator, reportAnalysisValidator, consultationSummaryValidator } = require('../validators/aiValidators');

router.use(authenticate, aiLimiter);

router.post('/assessment', assessmentValidator, validate, aiController.assessment);
router.post('/report-analysis', reportAnalysisValidator, validate, aiController.reportAnalysis);
router.post('/consultation-summary', consultationSummaryValidator, validate, aiController.consultationSummary);

module.exports = router;
