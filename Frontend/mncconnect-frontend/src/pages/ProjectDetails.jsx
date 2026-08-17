import React, { useState } from 'react';
import Auth from './Auth';

const ProjectDetails = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Navbar */}
      <nav className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                MNCConnect
              </h1>
              <p className="text-xs text-gray-500">Fresher to Mentor Network</p>
            </div>
          </div>
          <button
            onClick={() => setShowAuthModal(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2 rounded-lg hover:shadow-lg transition font-semibold"
          >
            Login
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-6">
            <div className="inline-block bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold">
              🚀 Connect. Learn. Grow.
            </div>
            <h2 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
              Bridge the Gap Between <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Freshers & Mentors</span>
            </h2>
            <p className="text-xl text-gray-600 leading-relaxed">
              MNCConnect is your dedicated platform to connect freshers with experienced professionals from top multinational companies. Get mentorship, guidance, and career insights directly from industry experts.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                onClick={() => setShowAuthModal(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-lg hover:shadow-lg transition font-bold text-lg"
              >
                Get Started
              </button>
              <button className="border-2 border-gray-300 text-gray-700 px-8 py-3 rounded-lg hover:border-gray-400 transition font-bold text-lg">
                Learn More
              </button>
            </div>
          </div>

          {/* Right Illustration */}
          <div className="hidden md:block relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-3xl opacity-20 blur-3xl"></div>
            <div className="relative bg-white rounded-3xl p-8 shadow-xl">
              <div className="space-y-4">
                <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full"></div>
                  <div>
                    <p className="font-bold text-gray-900">Expert Mentors</p>
                    <p className="text-sm text-gray-600">From leading MNCs</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full"></div>
                  <div>
                    <p className="font-bold text-gray-900">Real Guidance</p>
                    <p className="text-sm text-gray-600">Career-focused sessions</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full"></div>
                  <div>
                    <p className="font-bold text-gray-900">Networking</p>
                    <p className="text-sm text-gray-600">Build your professional network</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Auth Modal - Large Popup */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative animate-fadeIn">
            {/* Close Button */}
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-700 z-10 p-2 hover:bg-gray-100 rounded-full transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* Auth Component */}
            <Auth closeModal={() => setShowAuthModal(false)} isModal={true} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetails;
          