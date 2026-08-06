import React, { useState, useEffect } from 'react';
import API from '../api';
import io from 'socket.io-client';
import MeetingRoom from '../components/MeetingRoom';

const socket = io('http://localhost:5000');

const MentorDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [acceptedSessions, setAcceptedSessions] = useState([]);
  const [selectedReq, setSelectedReq] = useState(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [activeCallSession, setActiveCallSession] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const mentorCompany = user?.companyName || user?.mentorProfile?.companyName;

  // Real-time clock tick for exact time check
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchMentorRequests = async () => {
    try {
      const res = await API.get('/bookings/my-bookings');
      setRequests(res.data.filter(b => b.status === 'requested'));
      setAcceptedSessions(res.data.filter(b => b.status === 'accepted'));
    } catch (err) {
      console.error('Error loading requests:', err);
    }
  };

  useEffect(() => {
    fetchMentorRequests();
    if (mentorCompany) {
      const companyRoom = `company_${mentorCompany.toLowerCase().trim()}`;
      socket.emit('join_room', companyRoom);

      socket.on('new_fresher_request', () => {
        fetchMentorRequests();
      });
    }
    return () => socket.off('new_fresher_request');
  }, [mentorCompany]);

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post('/bookings/accept-slot', {
        bookingId: selectedReq._id,
        confirmedMeetingTime: scheduledDate,
        meetingLink: `MNCConnect-${selectedReq._id}`
      });
      alert('🎉 Session confirmed!');
      setSelectedReq(null);
      setScheduledDate('');
      fetchMentorRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to schedule');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 font-sans">
      {/* 📹 LIVE CALL OVERLAY */}
      {activeCallSession && (
        <MeetingRoom
          roomName={
            activeCallSession.meetingLink?.includes("http")
              ? activeCallSession.meetingLink.split("/").pop()
              : activeCallSession.meetingLink || `MNCConnect-${activeCallSession._id}`
          }
          userName={user.name || 'Mentor'}
          durationInMinutes={parseInt(activeCallSession.requestedDuration) || 30}
          onLeave={() => setActiveCallSession(null)}
        />
      )}

      {/* 📡 LIVE SCANNING RADAR HEADER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500"></span>
          </span>
          <div>
            <h4 className="text-sm font-bold text-white">Live Request Scanner Active</h4>
            <p className="text-xs text-slate-400">
              Scanning incoming fresher requests for {mentorCompany || "your company"}...
            </p>
          </div>
        </div>
        <span className="text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full animate-pulse">
          🔍 Scanning...
        </span>
      </div>

      <h2 className="text-2xl font-bold text-slate-900 mb-6">Mentor Session Dashboard</h2>

      {/* 📥 FRESHER REQUEST CARDS */}
      <div className="mb-10">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span>📨</span> Incoming Fresher Requests ({requests.length})
        </h3>

        {requests.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-8 text-center">
            <p className="text-slate-500 text-sm font-medium">No pending fresher requests at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {requests.map((req) => (
              <div 
                key={req._id} 
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-slate-900 text-base">
                      {req.fresherId?.name || 'Fresher Candidate'}
                    </h4>
                    <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-md border border-blue-100">
                      ⏱️ {req.requestedDuration || 30} Mins
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2">
                    {req.note || 'Requested a mentorship & interview guidance session.'}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Requested: {new Date(req.createdAt).toLocaleDateString()}
                  </span>
                  
                  <button
                    onClick={() => setSelectedReq(req)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm shadow-blue-200"
                  >
                    Accept & Schedule
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 📅 CONFIRMED SESSIONS */}
      <div className="mb-10">
        <h3 className="text-lg font-bold text-slate-800 mb-3">📅 Confirmed Sessions</h3>
        
        {acceptedSessions.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-xs">
            No confirmed scheduled meetings yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {acceptedSessions.map((session) => {
              const slotStart = session.confirmedMeetingTime ? new Date(session.confirmedMeetingTime) : null;
              const durationMins = parseInt(session.requestedDuration) || 30;
              const slotEnd = slotStart ? new Date(slotStart.getTime() + durationMins * 60 * 1000) : null;

              const isMeetingTimeNow = slotStart && slotEnd && currentTime >= slotStart && currentTime <= slotEnd;

              return (
                <div key={session._id} className="bg-emerald-50/50 border border-emerald-200 p-5 rounded-2xl">
                  <h4 className="font-bold text-slate-900 text-sm">Fresher: {session.fresherId?.name || 'Fresher'}</h4>
                  <p className="text-xs text-slate-600 mt-1">🕒 Scheduled: <strong>{slotStart?.toLocaleString()}</strong></p>

                  <button 
                    disabled={!isMeetingTimeNow}
                    onClick={() => isMeetingTimeNow && setActiveCallSession(session)}
                    className={`mt-4 w-full py-2.5 rounded-xl font-bold text-xs transition-all ${
                      isMeetingTimeNow
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm animate-pulse"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    📹 {isMeetingTimeNow ? "Start / Join Live Meeting" : "Join Button Locked Until Scheduled Time"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 🗓️ SCHEDULE MODAL */}
      {selectedReq && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Schedule Slot (Time format IST)</h3>
            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <input 
                type="datetime-local" 
                value={scheduledDate} 
                onChange={(e) => setScheduledDate(e.target.value)} 
                required 
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
              <div className="flex gap-3">
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl">
                  Confirm
                </button>
                <button 
                  type="button" 
                  onClick={() => setSelectedReq(null)} 
                  className="flex-1 py-2.5 bg-slate-100 text-xs font-bold rounded-xl text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MentorDashboard;