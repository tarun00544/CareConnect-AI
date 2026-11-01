import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell, CheckCircle2, Clock, AlertTriangle, Pill, RotateCcw,
  Check, X, Shield, Volume2, Moon, Sliders, ChevronRight,
  ShoppingCart, RefreshCw, CalendarDays, ExternalLink, Info
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import Modal from '../../components/ui/Modal';
import Field from '../../components/ui/Field';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../context/AppContext';
import {
  getTodayReminders,
  confirmTaken,
  snoozeReminder,
  skipReminder,
  getAdherenceStats,
  getMySchedules,
  configureRefillReminder,
  getUserPreferences,
  updateUserPreferences,
} from '../../services/reminderService';
import { formatDate } from '../../utils/format';

export default function MedicineRemindersPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [adherence, setAdherence] = useState(null);
  const [preferences, setPreferences] = useState(null);

  // Modals state
  const [prefModalOpen, setPrefModalOpen] = useState(false);
  const [snoozeModalTarget, setSnoozeModalTarget] = useState(null);
  const [skipModalTarget, setSkipModalTarget] = useState(null);
  const [skipReason, setSkipReason] = useState('Out of medication');
  const [skipNotes, setSkipNotes] = useState('');
  const [refillModalTarget, setRefillModalTarget] = useState(null);
  const [refillDaysBefore, setRefillDaysBefore] = useState(3);
  const [refillEnabled, setRefillEnabled] = useState(true);
  const [busyAction, setBusyAction] = useState(false);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [todayData, schedData, adhData, prefData] = await Promise.all([
        getTodayReminders(),
        getMySchedules({ activeOnly: true }),
        getAdherenceStats(7),
        getUserPreferences(),
      ]);
      setReminders(todayData?.reminders || []);
      setSchedules(schedData || []);
      setAdherence(adhData || null);
      setPreferences(prefData || null);
    } catch (err) {
      toast.error(err.message || 'Failed to load medicine reminders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Action: Confirm Taken
  const handleConfirmTaken = async (logId) => {
    try {
      setBusyAction(true);
      await confirmTaken(logId);
      toast.success('Dose confirmed as taken');
      await loadAllData();
    } catch (err) {
      toast.error(err.message || 'Failed to confirm dose');
    } finally {
      setBusyAction(false);
    }
  };

  // Action: Snooze
  const handleSnooze = async (minutes) => {
    if (!snoozeModalTarget) return;
    try {
      setBusyAction(true);
      await snoozeReminder(snoozeModalTarget._id, minutes);
      toast.success(`Reminder snoozed for ${minutes} minutes`);
      setSnoozeModalTarget(null);
      await loadAllData();
    } catch (err) {
      toast.error(err.message || 'Failed to snooze reminder');
    } finally {
      setBusyAction(false);
    }
  };

  // Action: Skip
  const handleSkip = async () => {
    if (!skipModalTarget) return;
    try {
      setBusyAction(true);
      const reasonText = skipNotes ? `${skipReason}: ${skipNotes}` : skipReason;
      await skipReminder(skipModalTarget._id, reasonText);
      toast.info('Dose marked as skipped');
      setSkipModalTarget(null);
      setSkipNotes('');
      await loadAllData();
    } catch (err) {
      toast.error(err.message || 'Failed to skip reminder');
    } finally {
      setBusyAction(false);
    }
  };

  // Action: Configure Refill
  const handleSaveRefill = async () => {
    if (!refillModalTarget) return;
    try {
      setBusyAction(true);
      await configureRefillReminder(refillModalTarget._id, {
        enabled: refillEnabled,
        remindDaysBefore: refillDaysBefore,
      });
      toast.success('Refill reminder preferences updated');
      setRefillModalTarget(null);
      await loadAllData();
    } catch (err) {
      toast.error(err.message || 'Failed to update refill reminder');
    } finally {
      setBusyAction(false);
    }
  };

  // Action: Save Preferences
  const handleSavePreferences = async (e) => {
    e.preventDefault();
    try {
      setBusyAction(true);
      const updated = await updateUserPreferences(preferences);
      setPreferences(updated);
      toast.success('Reminder & alert preferences saved');
      setPrefModalOpen(false);
    } catch (err) {
      toast.error(err.message || 'Failed to save preferences');
    } finally {
      setBusyAction(false);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading your personalized medicine schedule and adherence tracker…" />;
  }

  const summary = adherence?.summary || { totalScheduled: 0, confirmedTaken: 0, skipped: 0, unconfirmed: 0, adherenceRate: 100 };

  return (
    <div className="stack-lg">
      <PageHeader
        title="Smart Medicine Reminders"
        subtitle="Chronological schedules, real-time alert actions, and adherence confirmation."
        actions={
          <div className="row gap-xs">
            <button className="btn btn-secondary" onClick={() => setPrefModalOpen(true)}>
              <Sliders size={16} /> Notification Preferences
            </button>
            <button className="btn btn-ghost" onClick={loadAllData} title="Refresh">
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        }
      />

      {/* Overview Stat Cards */}
      <div className="grid grid-stats">
        <StatCard
          label="7-Day Adherence Rate"
          value={`${summary.adherenceRate}%`}
          icon={CheckCircle2}
          tone={summary.adherenceRate >= 80 ? 'teal' : 'amber'}
          hint="Based on confirmed doses"
        />
        <StatCard
          label="Confirmed Taken"
          value={summary.confirmedTaken}
          icon={Check}
          tone="teal"
          hint="Doses confirmed manually"
        />
        <StatCard
          label="Pending Confirmation"
          value={summary.unconfirmed}
          icon={Clock}
          tone="blue"
          hint="Unconfirmed doses (not marked missed)"
        />
        <StatCard
          label="Skipped Doses"
          value={summary.skipped}
          icon={X}
          tone="neutral"
          hint="Documented patient skips"
        />
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-2 gap-lg align-start">
        {/* Left Column: Today's Reminders Timeline */}
        <section className="card stack">
          <div className="row between border-b pb-sm">
            <div>
              <h3 className="section-title">Today's Medicine Schedule</h3>
              <div className="small muted">Live timeline for today ({new Date().toLocaleDateString()})</div>
            </div>
            <span className="badge badge-teal">{reminders.length} scheduled</span>
          </div>

          {reminders.length === 0 ? (
            <EmptyState
              compact
              icon={Pill}
              title="No Medicine Reminders Today"
              description="You have no scheduled doses due today. New prescriptions with schedules will appear here."
            />
          ) : (
            <div className="stack-sm">
              {reminders.map((log) => {
                const isTaken = log.status === 'TAKEN';
                const isSnoozed = log.status === 'SNOOZED';
                const isSkipped = log.status === 'SKIPPED';
                const isPending = log.status === 'PENDING';

                return (
                  <div
                    key={log._id}
                    className={`card p-md stack-xs ${isTaken ? 'border-success' : isSnoozed ? 'border-warning' : ''}`}
                    style={{
                      borderLeft: `5px solid ${
                        isTaken ? 'var(--teal-500, #14b8a6)' :
                        isSnoozed ? 'var(--amber-500, #f59e0b)' :
                        isSkipped ? 'var(--slate-400, #94a3b8)' :
                        'var(--blue-600, #2563eb)'
                      }`,
                    }}
                  >
                    <div className="row between wrap gap-xs">
                      <div>
                        <div className="row gap-xs center">
                          <strong style={{ fontSize: '1.05rem' }}>{log.medicineName}</strong>
                          {log.dosage && <span className="chip chip-soft">{log.dosage}</span>}
                        </div>
                        <div className="small muted mt-xs">
                          {log.instructions || 'Take as prescribed by doctor'}
                        </div>
                      </div>

                      <div className="row gap-xs center">
                        <Clock size={15} className="muted" />
                        <strong>{log.scheduledTime}</strong>
                      </div>
                    </div>

                    <div className="row between wrap gap-sm pt-xs border-t mt-xs center">
                      {/* Status indicator */}
                      <div>
                        {isTaken && (
                          <span className="badge badge-teal row center gap-xs">
                            <CheckCircle2 size={13} /> Taken {log.takenAt ? `at ${new Date(log.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                          </span>
                        )}
                        {isSnoozed && (
                          <span className="badge badge-amber row center gap-xs">
                            <RotateCcw size={13} /> Snoozed {log.snoozedUntil ? `until ${new Date(log.snoozedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                            {log.snoozeCount > 1 && ` (${log.snoozeCount}x)`}
                          </span>
                        )}
                        {isSkipped && (
                          <span className="badge badge-neutral row center gap-xs">
                            <X size={13} /> Skipped {log.skippedReason ? `(${log.skippedReason})` : ''}
                          </span>
                        )}
                        {isPending && (
                          <span className="badge badge-blue row center gap-xs">
                            <Clock size={13} /> Pending Confirmation
                          </span>
                        )}
                      </div>

                      {/* Action buttons (Never auto-mark taken) */}
                      {(isPending || isSnoozed) && (
                        <div className="row gap-xs">
                          <button
                            type="button"
                            className="btn btn-sm btn-primary row center gap-xs"
                            disabled={busyAction}
                            onClick={() => handleConfirmTaken(log._id)}
                          >
                            <Check size={14} /> Taken
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            disabled={busyAction}
                            onClick={() => setSnoozeModalTarget(log)}
                          >
                            Snooze
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            disabled={busyAction}
                            onClick={() => setSkipModalTarget(log)}
                          >
                            Skip
                          </button>
                        </div>
                      )}

                      {log.scheduleId?.prescriptionId && (
                        <Link
                          to={`/patient/prescriptions/${log.scheduleId.prescriptionId}`}
                          className="small muted row center gap-xs"
                        >
                          <span>Rx</span> <ExternalLink size={12} />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: Active Schedules, Refills & Weekly Adherence */}
        <div className="stack">
          {/* Active Prescribed Schedules */}
          <section className="card stack-sm">
            <div className="row between border-b pb-xs">
              <h3 className="section-title">Active Prescribed Schedules</h3>
              <span className="small muted">{schedules.length} Active</span>
            </div>

            {schedules.length === 0 ? (
              <p className="small muted">No active prescription schedules found.</p>
            ) : (
              <div className="stack-xs">
                {schedules.map((s) => {
                  const now = new Date();
                  const end = new Date(s.endDate);
                  const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

                  return (
                    <div key={s._id} className="card-soft p-sm rounded stack-xs">
                      <div className="row between">
                        <strong>{s.medicineName} {s.dosage ? `(${s.dosage})` : ''}</strong>
                        <span className="badge badge-teal">Daily {s.reminderTimes.join(', ')}</span>
                      </div>
                      <div className="small muted">{s.prescribedInstructions}</div>
                      <div className="row between small muted mt-xs border-t pt-xs">
                        <span>Course: {formatDate(s.startDate)} - {formatDate(s.endDate)}</span>
                        <span className={daysLeft <= 5 ? 'text-warning font-semibold' : ''}>
                          {daysLeft > 0 ? `${daysLeft} days remaining` : 'Course completed'}
                        </span>
                      </div>

                      {/* Refill Reminder Alert & Action */}
                      <div className="row between center pt-xs">
                        <div className="small row center gap-xs">
                          <Bell size={13} className={s.refillReminder?.enabled ? 'text-teal' : 'muted'} />
                          <span>
                            {s.refillReminder?.enabled
                              ? `Refill alert: ${s.refillReminder.remindDaysBefore} days before end`
                              : 'Refill alert off'}
                          </span>
                        </div>
                        <div className="row gap-xs">
                          <button
                            type="button"
                            className="btn btn-xs btn-secondary"
                            onClick={() => {
                              setRefillModalTarget(s);
                              setRefillEnabled(s.refillReminder?.enabled ?? true);
                              setRefillDaysBefore(s.refillReminder?.remindDaysBefore ?? 3);
                            }}
                          >
                            Set Alert
                          </button>
                          <Link to="/patient/pharmacy" className="btn btn-xs btn-primary row center gap-xs">
                            <ShoppingCart size={11} /> Order
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="small muted row center gap-xs mt-xs">
              <Info size={13} />
              <span>Refill alerts are informational reminders. Refills are never ordered or billed automatically.</span>
            </div>
          </section>

          {/* Adherence Confirmation Tracker */}
          <section className="card stack-sm">
            <div className="row between border-b pb-xs">
              <h3 className="section-title">7-Day Adherence History</h3>
              <span className="badge badge-primary">{summary.confirmedTaken} Confirmed</span>
            </div>

            {adherence?.dailyHistory?.length > 0 ? (
              <div className="stack-xs">
                {adherence.dailyHistory.map((d) => (
                  <div key={d.date} className="row between small p-xs border-b">
                    <span>{d.date}</span>
                    <div className="row gap-sm center">
                      <span className="text-success">{d.taken} taken</span>
                      {d.skipped > 0 && <span className="text-neutral">{d.skipped} skipped</span>}
                      {d.unconfirmed > 0 && <span className="text-warning">{d.unconfirmed} unconfirmed</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="small muted">No confirmation logs recorded in the last 7 days.</p>
            )}
            <p className="small muted" style={{ fontSize: '0.8rem' }}>
              Note: Unconfirmed reminders are labeled as "Unconfirmed", not missed doses.
            </p>
          </section>
        </div>
      </div>

      {/* Snooze Modal */}
      {snoozeModalTarget && (
        <Modal
          open={!!snoozeModalTarget}
          onClose={() => setSnoozeModalTarget(null)}
          title={`Snooze Reminder — ${snoozeModalTarget.medicineName}`}
          footer={<button className="btn btn-ghost" onClick={() => setSnoozeModalTarget(null)}>Cancel</button>}
        >
          <div className="stack">
            <p className="small">Select snooze duration for this dose:</p>
            <div className="grid grid-3 gap-sm">
              <button className="btn btn-secondary" onClick={() => handleSnooze(15)}>
                15 Minutes
              </button>
              <button className="btn btn-secondary" onClick={() => handleSnooze(30)}>
                30 Minutes
              </button>
              <button className="btn btn-secondary" onClick={() => handleSnooze(60)}>
                1 Hour
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Skip Modal */}
      {skipModalTarget && (
        <Modal
          open={!!skipModalTarget}
          onClose={() => setSkipModalTarget(null)}
          title={`Skip Dose — ${skipModalTarget.medicineName}`}
          footer={
            <div className="row gap-xs">
              <button className="btn btn-ghost" onClick={() => setSkipModalTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSkip} disabled={busyAction}>
                Confirm Skip
              </button>
            </div>
          }
        >
          <div className="stack">
            <Field label="Reason for skipping dose" htmlFor="skip-reason">
              <select
                id="skip-reason"
                className="select"
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
              >
                <option value="Out of medication">Out of medication</option>
                <option value="Experiencing side effects">Experiencing side effects</option>
                <option value="Doctor advised to pause">Doctor advised to pause</option>
                <option value="Forgot dose / timing passed">Forgot dose / timing passed</option>
                <option value="Other reason">Other reason</option>
              </select>
            </Field>

            <Field label="Additional notes (optional)" htmlFor="skip-notes">
              <textarea
                id="skip-notes"
                className="input"
                rows={2}
                value={skipNotes}
                onChange={(e) => setSkipNotes(e.target.value)}
                placeholder="Optional clinical notes for doctor's review"
              />
            </Field>
          </div>
        </Modal>
      )}

      {/* Refill Reminder Modal */}
      {refillModalTarget && (
        <Modal
          open={!!refillModalTarget}
          onClose={() => setRefillModalTarget(null)}
          title={`Refill Reminder — ${refillModalTarget.medicineName}`}
          footer={
            <div className="row gap-xs">
              <button className="btn btn-ghost" onClick={() => setRefillModalTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveRefill} disabled={busyAction}>
                Save Alert Settings
              </button>
            </div>
          }
        >
          <div className="stack">
            <label className="check">
              <input
                type="checkbox"
                checked={refillEnabled}
                onChange={(e) => setRefillEnabled(e.target.checked)}
              />
              <span>Enable refill reminder alert</span>
            </label>

            {refillEnabled && (
              <Field label="Alert me before course ends (days)" htmlFor="refill-days">
                <input
                  id="refill-days"
                  type="number"
                  min="1"
                  max="14"
                  className="input"
                  value={refillDaysBefore}
                  onChange={(e) => setRefillDaysBefore(Number(e.target.value))}
                />
              </Field>
            )}

            <p className="small muted">
              Refill alerts send a real-time reminder before your medication runs out so you can request a repeat prescription or order from the pharmacy.
            </p>
          </div>
        </Modal>
      )}

      {/* Preferences Modal (Module 7 & Module 8) */}
      {prefModalOpen && preferences && (
        <Modal
          open={prefModalOpen}
          onClose={() => setPrefModalOpen(false)}
          size="lg"
          title="Notification & Reminder Preferences"
          footer={
            <div className="row gap-xs">
              <button className="btn btn-ghost" onClick={() => setPrefModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSavePreferences} disabled={busyAction}>
                Save Preferences
              </button>
            </div>
          }
        >
          <form className="stack" onSubmit={handleSavePreferences}>
            <div className="grid grid-2 gap-md">
              <Field label="Reminder Sound" htmlFor="sound-select">
                <select
                  id="sound-select"
                  className="select"
                  value={preferences.reminderSound || 'chime'}
                  onChange={(e) => setPreferences({ ...preferences, reminderSound: e.target.value })}
                >
                  <option value="chime">Chime (Gentle Bell)</option>
                  <option value="gentle">Gentle Melody</option>
                  <option value="pulse">Pulse Tone</option>
                  <option value="bell">Hospital Bell</option>
                  <option value="default">System Default</option>
                </select>
              </Field>

              <Field label="Default Snooze Duration" htmlFor="snooze-default">
                <select
                  id="snooze-default"
                  className="select"
                  value={preferences.defaultSnoozeMinutes || 15}
                  onChange={(e) => setPreferences({ ...preferences, defaultSnoozeMinutes: Number(e.target.value) })}
                >
                  <option value={5}>5 minutes</option>
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </Field>
            </div>

            <div className="card-soft p-sm rounded stack-xs">
              <strong>Quiet Hours (Do Not Disturb)</strong>
              <label className="check">
                <input
                  type="checkbox"
                  checked={preferences.quietHours?.enabled ?? false}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      quietHours: { ...preferences.quietHours, enabled: e.target.checked },
                    })
                  }
                />
                <span>Enable Quiet Hours</span>
              </label>

              {preferences.quietHours?.enabled && (
                <div className="grid grid-2 gap-sm mt-xs">
                  <Field label="Start Time" htmlFor="qh-start">
                    <input
                      id="qh-start"
                      type="time"
                      className="input"
                      value={preferences.quietHours.start || '22:00'}
                      onChange={(e) =>
                        setPreferences({
                          ...preferences,
                          quietHours: { ...preferences.quietHours, start: e.target.value },
                        })
                      }
                    />
                  </Field>
                  <Field label="End Time" htmlFor="qh-end">
                    <input
                      id="qh-end"
                      type="time"
                      className="input"
                      value={preferences.quietHours.end || '07:00'}
                      onChange={(e) =>
                        setPreferences({
                          ...preferences,
                          quietHours: { ...preferences.quietHours, end: e.target.value },
                        })
                      }
                    />
                  </Field>
                </div>
              )}
            </div>

            {/* Lock-Screen Privacy (Module 8) */}
            <div className="card-soft p-sm rounded stack-xs">
              <strong>Lock-Screen & Mobile Privacy (Module 8)</strong>
              <label className="check">
                <input
                  type="checkbox"
                  checked={preferences.privacy?.maskLockScreenDetails ?? true}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      privacy: { ...preferences.privacy, maskLockScreenDetails: e.target.checked },
                    })
                  }
                />
                <span>
                  Mask medication details on lock-screen (generic <em>"Medication Reminder"</em> shown until unlocked)
                </span>
              </label>
            </div>

            <div className="small muted row center gap-xs">
              <Shield size={14} className="text-teal" />
              <span>
                Safety Invariant: Emergency notifications, hospital admissions, and critical doctor alerts always bypass quiet hours.
              </span>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
