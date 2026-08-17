import React, { useState } from 'react';
import { Menu, X, ArrowRight, Users, MessageCircle, Briefcase, Search, Link as LinkIcon, MessageSquare, TrendingUp } from 'lucide-react';
import Auth from './Auth';

const Landing = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Bar */}
      <nav className="fixed w-full bg-white/80 backdrop-blur-md border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">M</span>
              </div>
              <span className="font-bold text-xl text-gray-900">MNCConnect</span>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#about" className="text-gray-700 hover:text-blue-600 transition font-medium">About Us</a>
              <a href="#how" className="text-gray-700 hover:text-blue-600 transition font-medium">How It Works</a>
              <a href="#opportunities" className="text-gray-700 hover:text-blue-600 transition font-medium">Opportunities</a>
            </div>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center space-x-3">
              <button
                onClick={() => setLoginModalOpen(true)}
                className="px-5 py-2 text-gray-700 hover:text-blue-600 transition font-semibold"
              >
                Login
              </button>
              <button
                onClick={() => setLoginModalOpen(true)}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition font-semibold"
              >
                Get Started
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-gray-900" />
              ) : (
                <Menu className="w-6 h-6 text-gray-900" />
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden pb-4 border-t border-gray-200 space-y-3">
              <a href="#about" className="block px-4 py-2 text-gray-700 hover:text-blue-600">About Us</a>
              <a href="#how" className="block px-4 py-2 text-gray-700 hover:text-blue-600">How It Works</a>
              <a href="#opportunities" className="block px-4 py-2 text-gray-700 hover:text-blue-600">Opportunities</a>
              <div className="flex gap-2 px-4">
                <button onClick={() => setLoginModalOpen(true)} className="flex-1 px-4 py-2 text-blue-600 border border-blue-600 rounded-lg font-semibold">Login</button>
                <button onClick={() => setLoginModalOpen(true)} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold">Get Started</button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-6 inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
            ✨ Your Career Connection Platform
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight mb-6">
            Connect with professionals who are already
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"> where you want to go</span>
          </h1>

          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            MNCConnect bridges the gap between ambitious freshers and experienced professionals. Have real conversations, gain genuine insights, and unlock career opportunities with mentors from top multinational companies.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setLoginModalOpen(true)}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-2xl transition font-bold text-lg flex items-center justify-center gap-2"
            >
              Get Started <ArrowRight className="w-5 h-5" />
            </button>
            <button className="px-8 py-4 border-2 border-gray-300 text-gray-900 rounded-lg hover:border-gray-400 transition font-bold text-lg">
              Explore Professionals
            </button>
          </div>

          {/* Hero Stats */}
          <div className="mt-16 grid grid-cols-3 gap-8 max-w-xl mx-auto">
            <div>
              <div className="text-3xl font-bold text-blue-600">5000+</div>
              <div className="text-gray-600 text-sm">Active Professionals</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">10K+</div>
              <div className="text-gray-600 text-sm">Connections Made</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">95%</div>
              <div className="text-gray-600 text-sm">Success Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* Value Section */}
      <section id="about" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Why MNCConnect?</h2>
            <p className="text-xl text-gray-600">Everything you need for real career growth</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="bg-white p-8 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-xl transition">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Real Professionals</h3>
              <p className="text-gray-600">Verified mentors from Fortune 500 companies and leading startups. No bots, no fake profiles—just genuine experts.</p>
            </div>

            {/* Card 2 */}
            <div className="bg-white p-8 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-xl transition">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <MessageCircle className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">1-to-1 Conversations</h3>
              <p className="text-gray-600">Direct messaging and scheduled calls with professionals. Get personalized guidance tailored to your goals and challenges.</p>
            </div>

            {/* Card 3 */}
            <div className="bg-white p-8 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-xl transition">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Briefcase className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Career Opportunities</h3>
              <p className="text-gray-600">Discover job openings, internships, and referral opportunities shared by your mentors. Your network is your net worth.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-xl text-gray-600">Four simple steps to accelerate your career</p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">1</div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Search className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Find</h3>
              <p className="text-gray-600">Browse vetted professionals from your industry and dream companies.</p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">2</div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <LinkIcon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Connect</h3>
              <p className="text-gray-600">Send a personalized request to start a meaningful conversation.</p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">3</div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Talk</h3>
              <p className="text-gray-600">Have authentic conversations via chat or scheduled video calls.</p>
            </div>

            {/* Step 4 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">4</div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Grow</h3>
              <p className="text-gray-600">Gain insights, unlock opportunities, and accelerate your career.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="opportunities" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">Ready to transform your career?</h2>
          <p className="text-xl text-blue-100 mb-8">Join thousands of freshers who are already learning from the best.</p>
          <button
            onClick={() => setLoginModalOpen(true)}
            className="px-8 py-4 bg-white text-blue-600 rounded-lg hover:shadow-2xl transition font-bold text-lg hover:bg-gray-50"
          >
            Get Started Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">M</span>
                </div>
                <span className="font-bold text-white">MNCConnect</span>
              </div>
              <p className="text-sm">Connecting ambitious freshers with experienced professionals.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-blue-400 transition">How It Works</a></li>
                <li><a href="#" className="hover:text-blue-400 transition">Professionals</a></li>
                <li><a href="#" className="hover:text-blue-400 transition">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-blue-400 transition">About Us</a></li>
                <li><a href="#" className="hover:text-blue-400 transition">Blog</a></li>
                <li><a href="#" className="hover:text-blue-400 transition">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-blue-400 transition">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-blue-400 transition">Terms of Service</a></li>
                <li><a href="#" className="hover:text-blue-400 transition">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2024 MNCConnect. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      {/* Auth Modal */}
      {loginModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setLoginModalOpen(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full animate-fadeIn max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => setLoginModalOpen(false)}
              className="sticky top-0 right-0 float-right m-4 text-gray-400 hover:text-gray-700 z-10 p-2 hover:bg-gray-100 rounded-full transition"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Auth Component in Modal Mode */}
            <Auth 
              isModal={true} 
              closeModal={() => setLoginModalOpen(false)} 
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Landing;
