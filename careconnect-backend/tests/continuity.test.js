const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const reportComparisonService = require('../services/reportComparisonService');
const followUpService = require('../services/followUpService');
const aiService = require('../services/aiService');

describe('CareConnect Continuity Engine - Unit & Integration Verification', () => {

  it('1. should extract laboratory parameters accurately from unstructured text', () => {
    const sampleLabText = `
      Comprehensive Metabolic Panel
      Patient: Rohan Verma
      Fasting Blood Sugar: 112 mg/dL
      HbA1c: 6.4 %
      Total Cholesterol: 215 mg/dL
      Serum Creatinine: 1.1 mg/dL
      Systolic Blood Pressure: 135 / 88 mmHg
    `;

    const extracted = reportComparisonService.parseParametersFromText(sampleLabText);
    assert.ok(Array.isArray(extracted), 'Extracted output should be an array');
    assert.ok(extracted.length >= 4, `Expected at least 4 parameters extracted, got ${extracted.length}`);

    const fbs = extracted.find((p) => p.name.toLowerCase().includes('fasting blood sugar'));
    assert.ok(fbs, 'Fasting Blood Sugar must be extracted');
    assert.equal(fbs.value, 112);
    assert.equal(fbs.flag, 'HIGH', '112 mg/dL is above 99 mg/dL max and should be flagged HIGH');

    const hba1c = extracted.find((p) => p.name.toLowerCase().includes('hba1c'));
    assert.ok(hba1c, 'HbA1c must be extracted');
    assert.equal(hba1c.value, 6.4);
    assert.equal(hba1c.flag, 'HIGH', '6.4% is above 5.6% max and should be flagged HIGH');
  });

  it('2. should accurately evaluate parameters within normal range', () => {
    const normalText = 'Hemoglobin: 14.2 g/dL\nPlatelets: 250000 /mcL\nSerum Creatinine: 0.9 mg/dL';
    const extracted = reportComparisonService.parseParametersFromText(normalText);
    const hb = extracted.find((p) => p.name.toLowerCase().includes('hemoglobin'));
    assert.ok(hb);
    assert.equal(hb.flag, 'NORMAL');
  });

  it('3. should run Doctor AI Copilot task with resilient clinical fallback', async () => {
    const result = await aiService.runDoctorCopilotTask({
      taskType: 'CONSULTATION_DRAFT',
      contextData: {
        symptoms: 'Mild shortness of breath with physical exertion, productive cough',
        vitals: 'BP: 124/80, SpO2: 97%',
        notes: 'Advised chest X-ray and respiratory assessment',
      },
    });

    assert.ok(result, 'Copilot must return a response');
    assert.ok(result.content || result.bulletPoints, 'Copilot must provide content or clinical points');
    assert.ok(result.disclaimer, 'Copilot must include medical disclaimer');
  });

  it('4. should audit consultation data for missing information', async () => {
    const auditResult = await aiService.runDoctorCopilotTask({
      taskType: 'MISSING_INFO_CHECK',
      contextData: {
        symptoms: 'Headache',
        // vitals intentionally missing
      },
    });

    assert.ok(auditResult, 'Audit result should be defined');
    assert.ok(Array.isArray(auditResult.missingItems), 'missingItems must be an array');
  });

});
