const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const Bed = require('../models/Bed');
const Room = require('../models/Room');
const bedService = require('../services/bedService');
const { BED_STATUS } = require('../config/constants');

const listAvailableBeds = asyncHandler(async (req, res) => {
  const filter = { status: BED_STATUS.AVAILABLE };
  if (req.query.hospitalId) filter.hospitalId = req.query.hospitalId;
  if (req.query.roomId) filter.roomId = req.query.roomId;
  const beds = await Bed.find(filter).populate('roomId');
  new ApiResponse(200, beds).send(res);
});

const listRooms = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.hospitalId) filter.hospitalId = req.query.hospitalId;
  const rooms = await Room.find(filter);
  new ApiResponse(200, rooms).send(res);
});

const allocateBed = asyncHandler(async (req, res) => {
  const { bedId, admissionId } = req.body;
  if (!bedId || !admissionId) throw ApiError.badRequest('bedId and admissionId are required');
  const bed = await bedService.allocateBed({ bedId, admissionId });
  new ApiResponse(200, bed, 'Bed allocated').send(res);
});

const updateBedStatus = asyncHandler(async (req, res) => {
  const bed = await Bed.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  if (!bed) throw ApiError.notFound('Bed not found');
  new ApiResponse(200, bed, 'Bed status updated').send(res);
});

const releaseBed = asyncHandler(async (req, res) => {
  const bed = await bedService.releaseBed(req.body.bedId);
  new ApiResponse(200, bed, 'Bed released').send(res);
});

module.exports = { listAvailableBeds, listRooms, allocateBed, updateBedStatus, releaseBed };
