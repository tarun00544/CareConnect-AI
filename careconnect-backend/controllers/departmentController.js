const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const Department = require('../models/Department');

const listDepartments = asyncHandler(async (req, res) => {
  const filter = { status: 'ACTIVE' };
  if (req.query.hospitalId) filter.hospitalId = req.query.hospitalId;
  const departments = await Department.find(filter).populate('hospitalId', 'name');
  new ApiResponse(200, departments).send(res);
});

const getDepartment = asyncHandler(async (req, res) => {
  const department = await Department.findById(req.params.id).populate('hospitalId', 'name');
  if (!department) throw ApiError.notFound('Department not found');
  new ApiResponse(200, department).send(res);
});

module.exports = { listDepartments, getDepartment };
