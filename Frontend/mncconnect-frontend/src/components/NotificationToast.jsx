import React, { useState, useEffect } from 'react';

const NotificationToast = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // Listen for custom notification events
    const handleNotification = (e) => {
      const { message, type = 'info', duration = 3000 } = e.detail;
      const id = Date.now();
      
      setNotifications(prev => [...prev, { id, message, type }]);
      
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, duration);
    };

    window.addEventListener('showNotification', handleNotification);
    return () => window.removeEventListener('showNotification', handleNotification);
  }, []);

  const getStyles = (type) => {
    switch (type) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div className="fixed top-20 right-4 z-50 space-y-3">
      {notifications.map(notif => (
        <div
          key={notif.id}
          className={`${getStyles(notif.type)} text-white px-6 py-3 rounded-lg shadow-lg animate-slide-in`}
        >
          {notif.message}
        </div>
      ))}
    </div>
  );
};

export default NotificationToast;
