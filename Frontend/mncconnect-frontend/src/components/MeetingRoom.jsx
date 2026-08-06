import React, { useState, useEffect } from 'react';
import { JitsiMeeting } from '@jitsi/react-sdk';

const MeetingRoom = ({ roomName, userName, onLeave, durationInMinutes = 30 }) => {
  const [timeLeft, setTimeLeft] = useState(durationInMinutes * 60);
  const [jitsiApi, setJitsiApi] = useState(null);
  const [isMeetingStarted, setIsMeetingStarted] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);

  // 1. Live Countdown Engine (Runs ONLY when 2 or more participants are present)
  useEffect(() => {
    if (!isMeetingStarted) return; 

    if (timeLeft <= 0) {
      alert('⏰ Session Duration Ended! Meeting closing automatically.');
      if (jitsiApi) {
        jitsiApi.executeCommand('hangup');
      }
      onLeave();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isMeetingStarted, jitsiApi, onLeave]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col font-sans">
      {/* HEADER */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex justify-between items-center shadow-2xl z-10">
        <div className="flex items-center gap-3">
          <span className="flex h-3 w-3 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isMeetingStarted ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${isMeetingStarted ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
          </span>
          <div>
            <h3 className="text-white font-bold text-sm">MNC Connect Live Mentorship</h3>
            {/* 🔴 STATUS TEXT REQUIREMENT */}
            <p className="text-xs text-amber-400 font-semibold">
              {isMeetingStarted 
                ? `🟢 Both Connected (${participantCount} In Call)` 
                : "Time starts if another user is coming"}
            </p>
          </div>
        </div>

        {/* TIMER DISPLAY */}
        <div className={`px-6 py-2 rounded-xl border flex items-center gap-3 ${
          !isMeetingStarted 
            ? 'bg-slate-800 border-slate-700 text-slate-400' 
            : timeLeft <= 300 
            ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 animate-pulse' 
            : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
        }`}>
          <span className="text-lg">⏱️</span>
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-slate-400">
              {isMeetingStarted ? 'Time Left' : 'Timer Status'}
            </span>
            <span className="text-xl font-mono font-black">
              {isMeetingStarted ? formatTime(timeLeft) : 'PAUSED (Waiting for 2nd person)'}
            </span>
          </div>
        </div>

        <button 
          onClick={() => {
            if (jitsiApi) jitsiApi.executeCommand('hangup');
            onLeave();
          }}
          className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all"
        >
          End Call
        </button>
      </div>

      {/* JITSI FRAME */}
      <div className="flex-1 w-full bg-slate-900 relative">
        <JitsiMeeting
          domain="meet.jit.si"
          roomName={roomName}
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
            displayName: userName || 'User'
          }}
          onApiReady={(externalApi) => {
            setJitsiApi(externalApi);

            const updateParticipantStatus = () => {
              const otherParticipants = externalApi.getParticipantsInfo() || [];
              const totalCount = otherParticipants.length + 1; 

              setParticipantCount(totalCount);

              // 🔴 2 Persons Join Aana udane Timer Run aaganum
              if (totalCount >= 2) {
                setIsMeetingStarted(true);
              }
            };

            externalApi.addEventListener('participantJoined', updateParticipantStatus);
            externalApi.addEventListener('videoConferenceJoined', updateParticipantStatus);
            externalApi.addEventListener('participantLeft', updateParticipantStatus);
            
            externalApi.addEventListener('videoConferenceLeft', () => {
              onLeave();
            });
          }}
          getIFrameRef={(iframeRef) => { 
            iframeRef.style.height = '100%'; 
            iframeRef.style.width = '100%';
          }}
        />
      </div>
    </div>
  );
};

export default MeetingRoom;