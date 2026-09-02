import React from "react";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";

const MentorNotifications = () => {

  const notifications = [
    {
      id: 1,
      title: "Profile approved",
      message:
        "Your mentor profile has been successfully verified.",
      time: "Just now",
      type: "success",
    },
    {
      id: 2,
      title: "Welcome to MNCConnect",
      message:
        "Your mentor workspace is ready.",
      time: "10 minutes ago",
      type: "info",
    },
    {
      id: 3,
      title: "Complete your profile",
      message:
        "Add more professional skills to improve your visibility.",
      time: "2 hours ago",
      type: "info",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f7f8fa] p-5 md:p-10">

      <div className="max-w-4xl mx-auto">

        <Link
          to="/mentordashboard"
          className="inline-flex items-center gap-2 mb-8 text-sm text-gray-500 hover:text-black"
        >
          <ArrowLeft size={17} />
          Back to dashboard
        </Link>

        <div className="mb-8">

          <div className="flex items-center gap-3">

            <div className="flex items-center justify-center text-white bg-black w-11 h-11 rounded-xl">
              <Bell size={20} />
            </div>

            <div>
              <h1 className="text-3xl font-semibold">
                Notifications
              </h1>

              <p className="mt-1 text-gray-500">
                Stay updated with your mentor activity.
              </p>
            </div>

          </div>

        </div>


        <div className="overflow-hidden bg-white border border-gray-200 rounded-3xl">

          {notifications.map(
            (notification) => (

              <div
                key={notification.id}
                className="p-5 transition border-b md:p-6 last:border-b-0 hover:bg-gray-50"
              >

                <div className="flex gap-4">

                  <div className="flex items-center justify-center bg-gray-100 w-11 h-11 rounded-xl shrink-0">

                    {notification.type ===
                    "success" ? (
                      <CheckCircle2
                        size={20}
                        className="text-green-600"
                      />
                    ) : (
                      <ShieldCheck
                        size={20}
                      />
                    )}

                  </div>

                  <div className="flex-1">

                    <div className="flex justify-between gap-4">

                      <h3 className="font-semibold">
                        {notification.title}
                      </h3>

                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {notification.time}
                      </span>

                    </div>

                    <p className="mt-2 text-sm leading-6 text-gray-500">
                      {notification.message}
                    </p>

                  </div>

                </div>

              </div>

            )
          )}

        </div>

      </div>

    </div>
  );
};

export default MentorNotifications;