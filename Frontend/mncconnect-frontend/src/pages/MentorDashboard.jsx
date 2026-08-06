import React, { useState, useEffect } from 'react';
import API from '../api';
import io from 'socket.io-client';
import { JitsiMeeting } from '@jitsi/react-sdk';

const socket = io('http://localhost:5000'); // Backend Socket Server URL

const MentorDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [acceptedSessions, setAcceptedSessions] = useState([]);
  const [selectedReq, setSelectedReq] = useState(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  
  // In-App Video Call State
  const [activeCallRoom, setActiveCallRoom] = useState(null);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const mentorCompany = user?.companyName || user?.mentorProfile?.companyName;

  // Fetch Mentor Bookings (Both pending & accepted)
  const fetchMentorRequests = async () => {
    try {
      const res = await API.get('/bookings/my-bookings');
      
      // Separate requested vs accepted sessions
      const pending = res.data.filter(b => b.status === 'requested');
      const accepted = res.data.filter(b => b.status === 'accepted');

      setRequests(pending);
      setAcceptedSessions(accepted);
    } catch (err) {
      console.log('Error loading requests:', err);
    }
  };

  useEffect(() => {
    fetchMentorRequests();

    // Join company socket room for live notifications
    if (mentorCompany) {
      const companyRoom = `company_${mentorCompany.toLowerCase().trim()}`;
      socket.emit('join_room', companyRoom);

      socket.on('new_fresher_request', (data) => {
        alert(`🚨 NEW REQUEST!\nFresher: ${data.booking.requirements}\nCompany: ${data.booking.companyName}`);
        fetchMentorRequests();
      });
    }

    return () => {
      socket.off('new_fresher_request');
    };
  }, [mentorCompany]);

  // Handle Accepting and Scheduling Slot
 const handleScheduleSubmit = async (e) => {
  e.preventDefault();
  
  if (!selectedReq?._id) {
    alert("No request selected!");
    return;
  }

  try {
    const defaultMeetingRoom = `MNCConnect-${selectedReq._id}`;
    const finalMeetingLink = meetingLink.trim() || defaultMeetingRoom;

    // 🔴 IMPORTANT: Check endpoint path carefully!
    await API.post('/bookings/accept-slot', {
      bookingId: selectedReq._id,
      confirmedMeetingTime: scheduledDate,
      meetingLink: finalMeetingLink
    });

    alert('🎉 Session confirmed & Meeting link sent to Fresher!');
    setSelectedReq(null);
    setScheduledDate('');
    setMeetingLink('');
    fetchMentorRequests();
  } catch (err) {
    alert(err.response?.data?.message || 'Failed to schedule session');
  }
};

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      
      {/* 📹 IN-APP LIVE VIDEO CALL MODAL / OVERLAY */}
      {activeCallRoom && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
          <div className="bg-slate-900 text-white px-6 py-3 flex justify-between items-center border-b border-slate-800">
            <div>
              <h3 className="font-bold text-sm text-blue-400">MNC Connect Live Mentorship Room</h3>
              <p className="text-xs text-slate-400">Room: {activeCallRoom}</p>
            </div>
            <button 
              onClick={() => setActiveCallRoom(null)}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
            >
              End / Exit Meeting
            </button>
          </div>

          <div className="flex-1 w-full h-full">
            <JitsiMeeting
              domain="meet.jit.si"
              roomName={activeCallRoom}
              configOverwrite={{
                startWithAudioMuted: false,
                disableThirdPartyRequests: true,
                prejoinPageEnabled: false,
              }}
              interfaceConfigOverwrite={{
                TOOLBAR_BUTTONS: [
                  'microphone', 'camera', 'desktop', 'chat', 'raisehand',
                  'tileview', 'fullscreen', 'hangup'
                ],
              }}
              userInfo={{
                displayName: user.name || 'Mentor'
              }}
              onApiReady={(externalApi) => {
                externalApi.addEventListener('videoConferenceLeft', () => {
                  setActiveCallRoom(null);
                });
              }}
              getIFrameRef={(iframeRef) => { iframeRef.style.height = '100%'; }}
            />
          </div>
        </div>
      )}

      <h2 className="text-2xl font-bold text-slate-900 mb-6">Mentor Session Dashboard</h2>

      {/* 🟢 SECTION 1: CONFIRMED / UPCOMING SESSIONS */}
      <div className="mb-10">
        <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
          <span>📅</span> Confirmed Upcoming Sessions ({acceptedSessions.length})
        </h3>

        {acceptedSessions.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-5 text-slate-400 text-xs text-center">
            No confirmed sessions scheduled yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {acceptedSessions.map((session) => (
              <div key={session._id} className="bg-emerald-50/50 border border-emerald-200 p-5 rounded-2xl flex flex-col justify-between">
                <div>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">CONFIRMED</span>
                  <h4 className="font-bold text-slate-900 text-sm mt-2">Fresher: {session.fresherId?.name || 'Fresher'}</h4>
                  <p className="text-xs text-slate-600 mt-1">🕒 Scheduled Time: <strong>{new Date(session.confirmedMeetingTime).toLocaleString()}</strong></p>
                  <p className="text-xs text-slate-500 mt-1">📌 Topic: {session.requirements}</p>
                </div>

                <button 
                  onClick={() => {
                    // Extract Jitsi room name or use generated ID
                    const roomName = session.meetingLink?.includes('http') 
                      ? session.meetingLink.split('/').pop() 
                      : session.meetingLink || `MNCConnect-${session._id}`;
                    setActiveCallRoom(roomName);
                  }}
                  className="mt-4 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all"
                >
                  📹 Start / Join In-App Call
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🔴 SECTION 2: NEW FRESHER REQUESTS */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
          <span>🚨</span> New Broadcasted Requests ({requests.length})
        </h3>

        <div className="space-y-4">
          {requests.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-slate-500 text-sm text-center">
              No active pending session requests right now.
            </div>
          ) : (
            requests.map((req) => (
              <div key={req._id} className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-bold">PAID</span>
                    <span className="text-xs text-slate-500 font-semibold">{req.requestedDuration} Session</span>
                  </div>
                  <h4 className="font-bold text-slate-900 mt-2">Fresher: {req.fresherId?.name || 'Fresher Request'}</h4>
                  <p className="text-xs text-slate-600 mt-1">🗣️ Preferred Language: <strong>{req.languageChosen}</strong></p>
                  <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg mt-2 border border-slate-100">📌 Topic: {req.requirements}</p>
                  <p className="text-xs text-slate-400 mt-1">🕒 Preferred Window: {req.preferredTimeWindow}</p>
                </div>

                <button 
                  onClick={() => setSelectedReq(req)}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs whitespace-nowrap transition-colors"
                >
                  Accept & Schedule
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 🛠️ SCHEDULE MODAL */}
      {selectedReq && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Set Meeting Schedule</h3>
            <p className="text-xs text-slate-500 mb-4">Duration requested by Fresher: <strong>{selectedReq.requestedDuration}</strong></p>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date & Time Slot</label>
                <input 
                  type="datetime-local" 
                  value={scheduledDate} 
                  onChange={(e) => setScheduledDate(e.target.value)} 
                  required 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Custom Room / Meeting Link (Optional)</label>
                <input 
                  type="text" 
                  placeholder="Leave empty for auto in-app video room" 
                  value={meetingLink} 
                  onChange={(e) => setMeetingLink(e.target.value)} 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl">
                  Confirm & Send
                </button>
                <button 
                  type="button" 
                  onClick={() => setSelectedReq(null)} 
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
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