const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const Medicine = require('../models/Medicine');
const { getPagination, buildPaginatedResult } = require('../utils/pagination');

const listMedicines = asyncHandler(async (req, res) => {
  const filter = { status: 'ACTIVE' };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.search) filter.$text = { $search: req.query.search };

  const { page, limit, skip } = getPagination(req.query);
  const [items, total] = await Promise.all([
    Medicine.find(filter).skip(skip).limit(limit),
    Medicine.countDocuments(filter),
  ]);
  new ApiResponse(200, buildPaginatedResult(items, total, page, limit)).send(res);
});

const getMedicine = asyncHandler(async (req, res) => {
  const medicine = await Medicine.findById(req.params.id);
  if (!medicine) throw ApiError.notFound('Medicine not found');
  new ApiResponse(200, medicine).send(res);
});

const createMedicine = asyncHandler(async (req, res) => {
  const medicine = await Medicine.create(req.body);
  new ApiResponse(201, medicine, 'Medicine added').send(res);
});

const updateMedicine = asyncHandler(async (req, res) => {
  const medicine = await Medicine.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!medicine) throw ApiError.notFound('Medicine not found');
  new ApiResponse(200, medicine, 'Medicine updated').send(res);
});

const deleteMedicine = asyncHandler(async (req, res) => {
  const medicine = await Medicine.findByIdAndUpdate(req.params.id, { status: 'DISCONTINUED' }, { new: true });
  if (!medicine) throw ApiError.notFound('Medicine not found');
  new ApiResponse(200, null, 'Medicine discontinued').send(res);
});

module.exports = { listMedicines, getMedicine, createMedicine, updateMedicine, deleteMedicine };
