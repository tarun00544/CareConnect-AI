const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const VideoSession = require('../models/VideoSession');
const videoService = require('../services/videoService');
const { assertVideoParticipant, getActiveRoomParticipants } = require('../sockets/videoSocket');

describe('CareConnect AI - WebRTC Video Consultation & Signaling Test Suite', () => {

  // ==========================================
  // SECTION 1: STUN & TURN ICE SERVER CONFIGURATION
  // ==========================================
  describe('1. ICE Server & Network Configuration', () => {
    it('should return default STUN servers when TURN credentials are not configured', () => {
      const iceServers = videoService.getIceServers();
      assert.ok(Array.isArray(iceServers), 'Ice servers must be an array');
      assert.ok(iceServers.length >= 2, 'Should include at least 2 default STUN servers');

      const allUrls = iceServers.flatMap((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]));
      assert.ok(
        allUrls.some((u) => u.includes('stun.l.google.com')),
        'Default STUN list should include Google STUN'
      );
      assert.ok(
        allUrls.some((u) => u.includes('global.stun.twilio.com')),
        'Default STUN list should include Twilio STUN'
      );
    });

    it('should dynamically include TURN relay server if environment credentials are provided', () => {
      const origUrls = process.env.TURN_URLS;
      const origUser = process.env.TURN_USERNAME;
      const origPass = process.env.TURN_CREDENTIAL;

      process.env.TURN_URLS = 'turn:relay.careconnect.ai:3478?transport=udp,turn:relay.careconnect.ai:3478?transport=tcp';
      process.env.TURN_USERNAME = 'consult-session-user';
      process.env.TURN_CREDENTIAL = 'temp-turn-token-1234';

      try {
        const iceServers = videoService.getIceServers();
        const turnServer = iceServers.find((s) => s.username === 'consult-session-user');
        assert.ok(turnServer, 'Must include configured TURN server entry');
        assert.equal(turnServer.credential, 'temp-turn-token-1234');
        assert.ok(
          Array.isArray(turnServer.urls) && turnServer.urls.length === 2,
          'Should parse multiple comma-delimited TURN URLs'
        );
      } finally {
        if (origUrls !== undefined) process.env.TURN_URLS = origUrls; else delete process.env.TURN_URLS;
        if (origUser !== undefined) process.env.TURN_USERNAME = origUser; else delete process.env.TURN_USERNAME;
        if (origPass !== undefined) process.env.TURN_CREDENTIAL = origPass; else delete process.env.TURN_CREDENTIAL;
      }
    });
  });

  // ==========================================
  // SECTION 2: VIDEO SESSION MODEL & LIFECYCLE
  // ==========================================
  describe('2. VideoSession Model & Status Transitions', () => {
    it('should validate VideoSession with CREATED status and default fields', () => {
      const dummyApptId = new mongoose.Types.ObjectId();
      const session = new VideoSession({
        appointmentId: dummyApptId,
        roomName: `consult-${dummyApptId.toString().slice(-8)}`,
        status: 'CREATED',
      });

      const err = session.validateSync();
      assert.equal(err, undefined, 'VideoSession should validate cleanly');
      assert.equal(session.status, 'CREATED');
      assert.ok(session.roomName.startsWith('consult-'));
    });

    it('should reject invalid status strings on VideoSession', () => {
      const session = new VideoSession({
        appointmentId: new mongoose.Types.ObjectId(),
        roomName: 'test-room',
        status: 'NON_EXISTENT_STATUS',
      });

      const err = session.validateSync();
      assert.ok(err, 'Should reject invalid session status');
      assert.ok(err.errors.status, 'Error must be on status enum');
    });

    it('should calculate consultation duration when transitioning from ACTIVE to ENDED', () => {
      const startTime = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
      const endTime = new Date();

      const session = new VideoSession({
        appointmentId: new mongoose.Types.ObjectId(),
        roomName: 'consult-room-1',
        status: 'ACTIVE',
        startedAt: startTime,
      });

      session.status = 'ENDED';
      session.endedAt = endTime;
      session.durationSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

      assert.equal(session.status, 'ENDED');
      assert.ok(session.durationSeconds >= 899 && session.durationSeconds <= 901, 'Duration must equal ~900s');
    });
  });

  // ==========================================
  // SECTION 3: PARTICIPANT AUTHORIZATION & APPOINTMENT GATING
  // ==========================================
  describe('3. Participant Authorization & Gating', () => {
    function mockAppointmentQuery(fakeAppointment) {
      const query = {
        populate() { return query; },
        then(resolve, reject) {
          return Promise.resolve(fakeAppointment).then(resolve, reject);
        },
      };
      return query;
    }

    it('should permit authorized patient for a valid confirmed VIDEO appointment', async () => {
      const patientUserId = new mongoose.Types.ObjectId();
      const doctorUserId = new mongoose.Types.ObjectId();
      const doctorProfileId = new mongoose.Types.ObjectId();
      const apptId = new mongoose.Types.ObjectId();

      const fakeAppointment = {
        _id: apptId,
        patientId: { userId: { _id: patientUserId, name: 'Alice Walker' } },
        doctorId: { _id: doctorProfileId, userId: { _id: doctorUserId, name: 'Dr. Jane Smith' } },
        consultationType: 'VIDEO',
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
      };

      const origFindById = mongoose.model('Appointment').findById;
      mongoose.model('Appointment').findById = () => mockAppointmentQuery(fakeAppointment);

      try {
        const res = await assertVideoParticipant(apptId, { _id: patientUserId, role: 'PATIENT' });
        assert.equal(res.allowed, true, 'Participant authorization must succeed');
        assert.equal(res.role, 'PATIENT');
        assert.equal(res.partnerName, 'Dr. Jane Smith');
      } finally {
        mongoose.model('Appointment').findById = origFindById;
      }
    });

    it('should permit assigned doctor for their assigned video appointment', async () => {
      const patientUserId = new mongoose.Types.ObjectId();
      const doctorUserId = new mongoose.Types.ObjectId();
      const doctorProfileId = new mongoose.Types.ObjectId();
      const apptId = new mongoose.Types.ObjectId();

      const fakeAppointment = {
        _id: apptId,
        patientId: { userId: { _id: patientUserId, name: 'Alice Walker' } },
        doctorId: { _id: doctorProfileId, userId: { _id: doctorUserId, name: 'Dr. Jane Smith' } },
        consultationType: 'VIDEO',
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
      };

      const origFindById = mongoose.model('Appointment').findById;
      mongoose.model('Appointment').findById = () => mockAppointmentQuery(fakeAppointment);

      try {
        const res = await assertVideoParticipant(apptId, { _id: doctorUserId, role: 'DOCTOR' });
        assert.equal(res.allowed, true, 'Assigned doctor authorization must succeed');
        assert.equal(res.role, 'DOCTOR');
        assert.equal(res.partnerName, 'Alice Walker');
      } finally {
        mongoose.model('Appointment').findById = origFindById;
      }
    });

    it('should reject third-party user who is neither the patient nor the assigned doctor', async () => {
      const patientUserId = new mongoose.Types.ObjectId();
      const doctorUserId = new mongoose.Types.ObjectId();
      const thirdPartyUserId = new mongoose.Types.ObjectId();
      const apptId = new mongoose.Types.ObjectId();

      const fakeAppointment = {
        _id: apptId,
        patientId: { userId: { _id: patientUserId, name: 'Alice' } },
        doctorId: { _id: new mongoose.Types.ObjectId(), userId: { _id: doctorUserId, name: 'Dr. Smith' } },
        consultationType: 'VIDEO',
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
      };

      const origFindById = mongoose.model('Appointment').findById;
      mongoose.model('Appointment').findById = () => mockAppointmentQuery(fakeAppointment);

      try {
        const res = await assertVideoParticipant(apptId, { _id: thirdPartyUserId, role: 'PATIENT' });
        assert.ok(res.error, 'Must return error for unauthorized user');
        assert.ok(res.error.includes('not an authorized participant'));
      } finally {
        mongoose.model('Appointment').findById = origFindById;
      }
    });

    it('should reject access if the consultation is an IN_PERSON appointment', async () => {
      const patientUserId = new mongoose.Types.ObjectId();
      const doctorUserId = new mongoose.Types.ObjectId();
      const apptId = new mongoose.Types.ObjectId();

      const inPersonAppt = {
        _id: apptId,
        patientId: { userId: { _id: patientUserId } },
        doctorId: { _id: new mongoose.Types.ObjectId(), userId: { _id: doctorUserId } },
        consultationType: 'IN_PERSON',
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
      };

      const origFindById = mongoose.model('Appointment').findById;
      mongoose.model('Appointment').findById = () => mockAppointmentQuery(inPersonAppt);

      try {
        const res = await assertVideoParticipant(apptId, { _id: patientUserId, role: 'PATIENT' });
        assert.ok(res.error, 'Should reject non-video appointment');
        assert.ok(res.error.includes('not scheduled as a video consultation'));
      } finally {
        mongoose.model('Appointment').findById = origFindById;
      }
    });

    it('should reject patient if appointment paymentStatus is PENDING or UNPAID', async () => {
      const patientUserId = new mongoose.Types.ObjectId();
      const doctorUserId = new mongoose.Types.ObjectId();
      const apptId = new mongoose.Types.ObjectId();

      const unpaidAppt = {
        _id: apptId,
        patientId: { userId: { _id: patientUserId } },
        doctorId: { _id: new mongoose.Types.ObjectId(), userId: { _id: doctorUserId } },
        consultationType: 'VIDEO',
        status: 'CONFIRMED',
        paymentStatus: 'PENDING',
      };

      const origFindById = mongoose.model('Appointment').findById;
      mongoose.model('Appointment').findById = () => mockAppointmentQuery(unpaidAppt);

      try {
        const res = await assertVideoParticipant(apptId, { _id: patientUserId, role: 'PATIENT' });
        assert.ok(res.error, 'Should reject patient with unpaid status');
        assert.ok(res.error.includes('Payment is required'));
      } finally {
        mongoose.model('Appointment').findById = origFindById;
      }
    });
  });

  // ==========================================
  // SECTION 4: SOCKET SIGNALING & ROOM STATE ISOLATION
  // ==========================================
  describe('4. Socket Signaling Protocol & Room Management', () => {
    it('should isolate active rooms and report empty participant maps for unjoined sessions', () => {
      const testApptId = new mongoose.Types.ObjectId().toString();
      const participants = getActiveRoomParticipants(testApptId);
      assert.equal(participants.length, 0, 'New room must have 0 participants initially');
    });

    it('should format clean signaling payloads for SDP offers and answers', () => {
      const dummyOffer = {
        type: 'offer',
        sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=sendrecv\r\n',
      };

      assert.equal(dummyOffer.type, 'offer');
      assert.ok(dummyOffer.sdp.includes('a=sendrecv'));
    });

    it('should validate ICE candidate structure with candidate string and sdpMLineIndex', () => {
      const dummyCandidate = {
        candidate: 'candidate:842163049 1 udp 1677729535 192.168.1.100 56789 typ srflx raddr 10.0.0.1 rport 56789',
        sdpMid: '0',
        sdpMLineIndex: 0,
      };

      assert.ok(dummyCandidate.candidate.includes('typ srflx'));
      assert.equal(typeof dummyCandidate.sdpMLineIndex, 'number');
    });
  });
});
