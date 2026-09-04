import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  GraduationCap,
  User,
  Wallet,
} from "lucide-react";

const INITIAL_NOTIFICATIONS = [
  {
    id: 1,
    type: "session",
    title: "Mentoring Session Confirmed",
    message: "Your mentoring session has been confirmed successfully.",
    time: "5 min ago",
    unread: true,
  },
  {
    id: 2,
    type: "bonus",
    title: "₹25 Bonus Added",
    message: "You received ₹25 for completing a mentoring session.",
    time: "30 min ago",
    unread: true,
  },
  {
    id: 3,
    type: "mentor",
    title: "New Mentor Available",
    message: "A new mentor from a top company is now available.",
    time: "1 hour ago",
    unread: true,
  },
  {
    id: 4,
    type: "booking",
    title: "Upcoming Session",
    message: "Your mentoring session is scheduled for today.",
    time: "2 hours ago",
    unread: true,
  },
  {
    id: 5,
    type: "referral",
    title: "Referral Bonus",
    message: "Your referral was successful. ₹25 has been added.",
    time: "3 hours ago",
    unread: true,
  },
  {
    id: 6,
    type: "welcome",
    title: "Welcome to MNCConnect",
    message: "Your ₹25 welcome bonus has been added to your wallet.",
    time: "Yesterday",
    unread: true,
  },
  {
    id: 7,
    type: "session",
    title: "Session Reminder",
    message: "Don't forget your upcoming mentoring session.",
    time: "Yesterday",
    unread: false,
  },
  {
    id: 8,
    type: "system",
    title: "Profile Update",
    message: "Complete your profile to improve your mentor experience.",
    time: "2 days ago",
    unread: false,
  },
];

const getNotificationIcon = (type) => {
  switch (type) {
    case "session":
      return <GraduationCap size={20} />;
    case "bonus":
      return <Wallet size={20} />;
    case "mentor":
      return <User size={20} />;
    case "booking":
      return <CalendarDays size={20} />;
    case "referral":
      return <User size={20} />;
    default:
      return <Bell size={20} />;
  }
};

const Notifications = () => {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState(
    INITIAL_NOTIFICATIONS
  );

  const [filter, setFilter] = useState("all");

  const unreadCount = useMemo(() => {
    return notifications.filter((item) => item.unread).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((item) => item.unread);
    }

    return notifications;
  }, [notifications, filter]);

  const markAsRead = (id) => {
    setNotifications((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              unread: false,
            }
          : item
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications((current) =>
      current.map((item) => ({
        ...item,
        unread: false,
      }))
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-6 flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/Home")}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100"
          >
            <ArrowLeft size={20} />
          </button>

          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Notifications
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Stay updated with your mentoring activity.
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Bell size={22} />
              </div>

              <div>
                <p className="text-sm font-bold text-slate-900">
                  Notification Center
                </p>

                <p className="text-xs text-slate-500">
                  {unreadCount} unread notification
                  {unreadCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700"
              >
                <CheckCheck size={17} />
                Mark all as read
              </button>
            )}
          </div>
        </div>

        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                filter === "all"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              All
            </button>

            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                filter === "unread"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Unread
            </button>
          </div>

          <span className="hidden text-sm font-medium text-slate-400 sm:block">
            {filteredNotifications.length} notification
            {filteredNotifications.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {filteredNotifications.length === 0 ? (
            <div className="flex min-h-[350px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Bell size={30} />
              </div>

              <h2 className="text-lg font-bold text-slate-800">
                No unread notifications
              </h2>

              <p className="mt-1 max-w-sm text-sm text-slate-500">
                You're all caught up. New notifications will appear here.
              </p>
            </div>
          ) : (
            <div>
              {filteredNotifications.map((notification, index) => (
                <div
                  key={notification.id}
                  className={`group flex gap-4 px-4 py-5 transition sm:px-6 ${
                    notification.unread
                      ? "bg-indigo-50/30 hover:bg-indigo-50/60"
                      : "hover:bg-slate-50"
                  } ${
                    index !== filteredNotifications.length - 1
                      ? "border-b border-slate-100"
                      : ""
                  }`}
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                      notification.unread
                        ? "bg-indigo-100 text-indigo-600"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-slate-900 sm:text-base">
                          {notification.title}
                        </h2>

                        {notification.unread && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-600" />
                        )}
                      </div>

                      <span className="shrink-0 text-xs font-medium text-slate-400">
                        {notification.time}
                      </span>
                    </div>

                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                      {notification.message}
                    </p>

                    {notification.unread && (
                      <button
                        type="button"
                        onClick={() => markAsRead(notification.id)}
                        className="mt-3 flex items-center gap-1 text-xs font-bold text-indigo-600 transition hover:text-indigo-800"
                      >
                        Mark as read
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => navigate("/Home")}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft size={17} />
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default Notifications;