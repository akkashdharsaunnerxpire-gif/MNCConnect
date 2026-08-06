import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';

const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('fresher');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
    designation: '',
    languages: 'Tamil, English',
    hourlyRate: 300
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        const res = await API.post('/auth/login', {
          email: formData.email,
          password: formData.password
        });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data));
        navigate('/mentors');
      } else {
        const payload = {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role,
          mentorProfile: role === 'mentor' ? {
            companyName: formData.companyName,
            designation: formData.designation,
            languages: formData.languages.split(',').map(l => l.trim()),
            hourlyRate: formData.hourlyRate
          } : {}
        };
        const res = await API.post('/auth/register', payload);
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data));
        navigate('/mentors');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Something went wrong');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8">
        
        {/* Title */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isLogin ? 'Connect with top MNC mentors instantly' : 'Join MNCConnect to boost your career'}
          </p>
        </div>

        {/* Role Toggle Switch */}
        {!isLogin && (
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            <button 
              type="button" 
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                role === 'fresher' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
              onClick={() => setRole('fresher')}
            >
              Fresher
            </button>
            <button 
              type="button" 
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                role === 'mentor' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
              onClick={() => setRole('mentor')}
            >
              MNC Mentor
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input 
                type="text" name="name" placeholder="Rakhul Prakash" onChange={handleChange} required 
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <input 
              type="email" name="email" placeholder="name@domain.com" onChange={handleChange} required 
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <input 
              type="password" name="password" placeholder="••••••••" onChange={handleChange} required 
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          {!isLogin && role === 'mentor' && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name</label>
                <input 
                  type="text" name="companyName" placeholder="TCS, Zoho, Amazon" onChange={handleChange} required 
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
                <input 
                  type="text" name="designation" placeholder="Software Engineer" onChange={handleChange} required 
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Languages (Comma separated)</label>
                <input 
                  type="text" name="languages" value={formData.languages} onChange={handleChange}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          <button 
            type="submit" 
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm rounded-lg shadow-md shadow-blue-500/20 transition-all mt-2"
          >
            {isLogin ? 'Sign In' : 'Register Account'}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)} 
            className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Login'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default Auth;