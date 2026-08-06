import React, { useState } from 'react';
import API from '../api';

const AIPrepModal = ({ booking, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [aiPlan, setAiPlan] = useState(null);

  const fetchAiGuide = async () => {
    setLoading(true);
    try {
      const res = await API.post('/ai/generate-questions', {
        companyName: booking.companyName,
        requirements: booking.requirements,
        duration: booking.requestedDuration
      });
      setAiPlan(res.data);
    } catch (err) {
      alert('Failed to generate AI insights');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-600 text-white text-xs px-2.5 py-1 rounded-md font-bold">AI ASSISTANT</span>
            <h3 className="font-bold text-slate-900">{booking.companyName} Session Prep Kit</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        {!aiPlan ? (
          <div className="text-center py-6">
            <p className="text-xs text-slate-600 mb-4">
              Generate custom interview questions and guidance sheet tailored for your upcoming <strong>{booking.companyName}</strong> session.
            </p>
            <button 
              onClick={fetchAiGuide}
              disabled={loading}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-500/20"
            >
              {loading ? 'AI Generating Prep Sheet...' : '✨ Generate AI Prep Sheet'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
              <h4 className="text-xs font-bold text-indigo-900 mb-1">Key Focus Topics:</h4>
              <ul className="list-disc list-inside text-xs text-indigo-800 space-y-1">
                {aiPlan.recommendedTopics.map((topic, index) => (
                  <li key={index}>{topic}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-800 mb-2">Practice Questions:</h4>
              <div className="space-y-2">
                {aiPlan.customQuestions.map((q, i) => (
                  <div key={i} className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-700 font-medium">
                    {i + 1}. {q}
                  </div>
                ))}
              </div>
            </div>

            <button onClick={onClose} className="w-full py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl mt-2">
              Done & Start Practice
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIPrepModal;