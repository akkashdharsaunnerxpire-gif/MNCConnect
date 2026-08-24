import React, { useEffect, useState } from "react";

const API_URL = "http://localhost:5000";

const MentorDashboard = () => {
  const [mentor, setMentor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchMentor = async () => {
      try {
        const token = localStorage.getItem("mnc_mentor_token");

        if (!token) {
          setError("Mentor login required.");
          setLoading(false);
          return;
        }

        const response = await fetch(
          `${API_URL}/api/auth/me`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to fetch mentor data"
          );
        }

        setMentor(data.user);
      } catch (error) {
        console.error("Mentor data error:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMentor();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <h2 className="text-xl font-semibold">
          Loading...
        </h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">
          {error}
        </p>
      </div>
    );
  }

  if (!mentor) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Mentor data not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">

      <div className="max-w-5xl mx-auto">

        <div className="bg-white rounded-2xl shadow-lg p-8">

          <div className="flex items-center gap-5 mb-8">

            <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">

              {mentor.profilePic ? (
                <img
                  src={mentor.profilePic}
                  alt={mentor.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-bold text-gray-500">
                  {mentor.name?.charAt(0)?.toUpperCase()}
                </span>
              )}

            </div>

            <div>
              <h1 className="text-3xl font-bold">
                Welcome, {mentor.name}
              </h1>

              <p className="text-gray-500 mt-1">
                {mentor.designation}
              </p>

              <p className="text-gray-500">
                {mentor.company}
              </p>
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div>
              <p className="text-sm text-gray-500">
                Name
              </p>

              <p className="font-semibold">
                {mentor.name}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Email
              </p>

              <p className="font-semibold">
                {mentor.email}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Mobile
              </p>

              <p className="font-semibold">
                {mentor.fullMobile || mentor.mobile}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Employee ID
              </p>

              <p className="font-semibold">
                {mentor.employeeId || "Not available"}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Company
              </p>

              <p className="font-semibold">
                {mentor.company}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Designation
              </p>

              <p className="font-semibold">
                {mentor.designation}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Department
              </p>

              <p className="font-semibold">
                {mentor.department}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Experience
              </p>

              <p className="font-semibold">
                {mentor.experience} years
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Location
              </p>

              <p className="font-semibold">
                {mentor.location || "Not available"}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Work Email
              </p>

              <p className="font-semibold">
                {mentor.workEmail || "Not available"}
              </p>
            </div>

          </div>

          <div className="mt-8">

            <p className="text-sm text-gray-500">
              Skills
            </p>

            <div className="flex flex-wrap gap-2 mt-2">

              {mentor.skills?.length > 0 ? (
                mentor.skills.map((skill, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 rounded-full text-sm"
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <p>No skills available.</p>
              )}

            </div>

          </div>

          <div className="mt-8">

            <p className="text-sm text-gray-500">
              Bio
            </p>

            <p className="mt-2">
              {mentor.bio || "No bio available."}
            </p>

          </div>

          <div className="mt-8">

            <p className="text-sm text-gray-500">
              LinkedIn
            </p>

            {mentor.linkedin ? (
              <a
                href={mentor.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                View LinkedIn Profile
              </a>
            ) : (
              <p>Not available.</p>
            )}

          </div>

          <div className="mt-8 flex gap-3">

            <span className="px-4 py-2 rounded-full bg-green-100 text-green-700">
              {mentor.verificationStatus}
            </span>

            <span className="px-4 py-2 rounded-full bg-blue-100 text-blue-700">
              {mentor.accountStatus}
            </span>

          </div>

        </div>

      </div>

    </div>
  );
};

export default MentorDashboard;