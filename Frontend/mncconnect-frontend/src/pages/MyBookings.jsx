import React, { useState, useEffect } from 'react';
import API from '../api';

const MyBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [meetingLinkInput, setMeetingLinkInput] = useState('');
  const [activeBookingId, setActiveBookingId] = useState(null);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchBookings = async () => {
    try {
      const res = await API.get('/bookings/my-bookings');
      setBookings(res.data);
    } catch (err) {
      alert('Error fetching bookings');
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleStatusUpdate = async (id, status, meetingLink = '') => {
    try {
      await API.put(`/bookings/${id}`, { status, meetingLink });
      alert(`Booking ${status} successfully!`);
      setActiveBookingId(null);
      fetchBookings();
    } catch (err) {
      alert('Failed to update booking status');
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '30px auto', padding: '0 20px' }}>
      <h2>My Sessions & Bookings</h2>
      
      {bookings.length === 0 ? (
        <p>No bookings found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
          {bookings.map((booking) => (
            <div key={booking._id} style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '15px', background: '#f9f9f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0 }}>
                    {currentUser.role === 'fresher' 
                      ? `Mentor: ${booking.mentorId?.name || 'N/A'} (${booking.mentorId?.mentorProfile?.companyName || ''})` 
                      : `Fresher: ${booking.fresherId?.name || 'N/A'}`}
                  </h4>
                  <p style={{ margin: '5px 0', fontSize: '14px', color: '#555' }}>
                    📅 Date: {new Date(booking.sessionDate).toLocaleDateString()} | ⏰ {booking.timeSlot}
                  </p>
                  <p style={{ margin: '5px 0', fontSize: '14px' }}>🗣️ Language: {booking.languageChosen}</p>
                </div>
                <div>
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '4px', 
                    fontSize: '12px', 
                    fontWeight: 'bold',
                    background: booking.status === 'confirmed' ? '#d4edda' : booking.status === 'pending' ? '#fff3cd' : '#f8d7da',
                    color: booking.status === 'confirmed' ? '#155724' : booking.status === 'pending' ? '#856404' : '#721c24'
                  }}>
                    {booking.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Display Meeting Link if available */}
              {booking.meetingLink && (
                <div style={{ marginTop: '10px', padding: '8px', background: '#e2e3e5', borderRadius: '4px' }}>
                  🔗 <strong>Meeting Link:</strong> <a href={booking.meetingLink} target="_blank" rel="noreferrer">{booking.meetingLink}</a>
                </div>
              )}

              {/* Mentor Actions to confirm and add meeting link */}
              {currentUser.role === 'mentor' && booking.status === 'pending' && (
                <div style={{ marginTop: '15px', borderTop: '1px solid #ddd', paddingTop: '10px' }}>
                  {activeBookingId === booking._id ? (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input 
                        type="text" 
                        placeholder="Paste Google Meet / Zoom Link" 
                        value={meetingLinkInput} 
                        onChange={(e) => setMeetingLinkInput(e.target.value)} 
                        style={{ flex: 1, padding: '6px' }}
                      />
                      <button 
                        onClick={() => handleStatusUpdate(booking._id, 'confirmed', meetingLinkInput)}
                        style={{ padding: '6px 12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px' }}
                      >
                        Confirm Session
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setActiveBookingId(booking._id)}
                      style={{ padding: '6px 12px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Accept & Add Link
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyBookings;