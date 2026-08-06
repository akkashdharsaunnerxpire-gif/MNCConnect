import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000'); // Backend URL

const NotificationToast = () => {
  const [notification, setNotification] = useState(null);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (user._id) {
      socket.emit('join_room', user._id);
    }

    socket.on('session_scheduled', (data) => {
      setNotification(data);
      // Auto clear after 6 seconds
      setTimeout(() => setNotification(null), 6000);
    });

    return () => socket.off('session_scheduled');
  }, [user._id]);

  if (!notification) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 animate-bounce">
      <div className="flex items-start gap-3">
        <span className="text-2xl">🎉</span>
        <div>
          <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Session Confirmed!</h4>
          <p className="text-xs text-slate-200 mt-1 font-medium">{notification.message}</p>
          <p className="text-[11px] text-slate-400 mt-1">⏰ {notification.timeSlot}</p>
          <a 
            href={notification.meetingLink} 
            target="_blank" 
            rel="noreferrer" 
            className="inline-block mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] rounded-lg"
          >
            Join Google Meet
          </a>
        </div>
      </div>
    </div>
  );
};

export default NotificationToast;