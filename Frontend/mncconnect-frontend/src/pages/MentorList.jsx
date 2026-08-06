import React, { useState, useEffect } from 'react';
import API from '../api';

const MentorList = () => {
  const [mentors, setMentors] = useState([]);
  const [language, setLanguage] = useState('');
  const [company, setCompany] = useState('');
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [sessionDate, setSessionDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('07:00 PM - 07:30 PM');

  const fetchMentors = async () => {
    try {
      const res = await API.get('/mentors', { params: { language, company } });
      setMentors(res.data);
    } catch (err) {
      alert('Error loading mentors');
    }
  };

  useEffect(() => {
    fetchMentors();
  }, [language, company]);

  const handleBooking = async (e) => {
    e.preventDefault();
    if (!selectedMentor) return;

    try {
      await API.post('/bookings', {
        mentorId: selectedMentor._id,
        sessionDate,
        timeSlot,
        languageChosen: language || 'Tamil',
        amountPaid: selectedMentor.mentorProfile?.hourlyRate || 300,
        notes: 'Career guidance request'
      });
      alert('Booking request sent successfully!');
      setSelectedMentor(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Booking failed');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Title & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">MNC Mentors Directory</h1>
          <p className="text-xs text-slate-500 mt-1">Book 1-on-1 career guidance & mock interview sessions</p>
        </div>

        <div className="flex gap-3">
          <select 
            value={language} onChange={(e) => setLanguage(e.target.value)} 
            className="px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">All Languages</option>
            <option value="Tamil">Tamil</option>
            <option value="English">English</option>
            <option value="Hindi">Hindi</option>
          </select>

          <input 
            type="text" placeholder="Filter by Company..." value={company} 
            onChange={(e) => setCompany(e.target.value)} 
            className="px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-48 sm:w-64"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {mentors.map((mentor) => (
          <div key={mentor._id} className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{mentor.name}</h3>
                  <p className="text-xs font-semibold text-blue-600 mt-0.5">
                    {mentor.mentorProfile?.designation} @ <span className="text-slate-800">{mentor.mentorProfile?.companyName}</span>
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-1 rounded-md">
                  ₹{mentor.mentorProfile?.hourlyRate || 300}
                </span>
              </div>

              <div className="text-xs text-slate-600 space-y-1 mb-5">
                <p className="flex items-center gap-1.5">
                  <span>🗣️</span> {mentor.mentorProfile?.languages?.join(', ')}
                </p>
              </div>
            </div>

            <button 
              onClick={() => setSelectedMentor(mentor)}
              className="w-full py-2.5 bg-slate-900 hover:bg-blue-600 text-white font-semibold text-xs rounded-lg transition-all"
            >
              Book Session
            </button>
          </div>
        ))}
      </div>

      {/* Modal Backdrop */}
      {selectedMentor && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Book Session</h3>
            <p className="text-xs text-slate-500 mb-4">with <span className="font-semibold text-slate-800">{selectedMentor.name}</span></p>

            <form onSubmit={handleBooking} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                <input 
                  type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} required 
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Time Slot</label>
                <select 
                  value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} 
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="06:00 PM - 06:30 PM">06:00 PM - 06:30 PM</option>
                  <option value="07:00 PM - 07:30 PM">07:00 PM - 07:30 PM</option>
                  <option value="08:00 PM - 08:30 PM">08:00 PM - 08:30 PM</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg">Confirm</button>
                <button type="button" onClick={() => setSelectedMentor(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default MentorList;