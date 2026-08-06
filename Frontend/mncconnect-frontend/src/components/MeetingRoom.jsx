import React, { useState, useEffect } from 'react';
import { JitsiMeeting } from '@jitsi/react-sdk';

const MeetingRoom = ({ roomName, userName, onLeave, durationInMinutes = 30 }) => {
  const [timeLeft, setTimeLeft] = useState(durationInMinutes * 60);
  const [jitsiApi, setJitsiApi] = useState(null);
  const [isMeetingStarted, setIsMeetingStarted] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);

  // 1. Live Countdown Engine (Runs ONLY when 2 or more participants are present)
  useEffect(() => {
    if (!isMeetingStarted) return; // 🛑 2 perum varalana timer pause-la irukum!

    if (timeLeft <= 0) {
      alert('⏰ 30 Minutes Session Completed! Meeting is closing automatically.');
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

  // Format seconds -> MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col font-sans">
      {/* --- TOP HEADER BAR WITH SCREEN TIMER --- */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex justify-between items-center shadow-2xl z-10">
        
        {/* Left Side Info */}
        <div className="flex items-center gap-3">
          <span className="flex h-3 w-3 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isMeetingStarted ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${isMeetingStarted ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
          </span>
          <div>
            <h3 className="text-white font-bold text-sm tracking-wide">MNC Connect Live Mentorship</h3>
            <p className="text-xs text-slate-400 font-medium">
              {isMeetingStarted ? `🟢 Active Call (${participantCount} Joined)` : '⏳ Waiting for 2nd participant to join...'}
            </p>
          </div>
        </div>

        {/* 🟢 CENTER SCREEN TIMER (BIG & CLEAR DISPLAY) */}
        <div className={`px-6 py-2 rounded-xl border flex items-center gap-3 shadow-lg transition-all ${
          !isMeetingStarted 
            ? 'bg-slate-800/80 border-slate-700 text-slate-400' 
            : timeLeft <= 300 
            ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 animate-pulse' 
            : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
        }`}>
          <span className="text-lg">⏱️</span>
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
              {isMeetingStarted ? 'Session Time Left' : 'Timer Status'}
            </span>
            <span className="text-xl font-mono font-black tracking-wider">
              {isMeetingStarted ? formatTime(timeLeft) : 'PAUSED (Waiting)'}
            </span>
          </div>
        </div>

        {/* Right Side Action */}
        <button 
          onClick={() => {
            if (jitsiApi) jitsiApi.executeCommand('hangup');
            onLeave();
          }}
          className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
        >
          End Call / Leave
        </button>
      </div>

      {/* --- JITSI EMBEDDED IFRAME --- */}
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

            // 🟢 Participant Check Engine
            const updateParticipantStatus = () => {
              // getParticipantsInfo array + 1 (Current User)
              const otherParticipants = externalApi.getParticipantsInfo() || [];
              const totalCount = otherParticipants.length + 1; 

              setParticipantCount(totalCount);

              // 2 or more participants connected -> START TIMER
              if (totalCount >= 2) {
                setIsMeetingStarted(true);
              }
            };

            // Event Handlers for Join/Leave
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