import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Users,
  Bell,
  Home,
  CalendarDays,
  MessageSquare,
  LayoutDashboard,
  Sparkles,
  Menu,
  X,
  WalletCards,
  ChevronRight,
  Banknote,
} from "lucide-react";

const Header = () => {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [balance, setBalance] = useState(25);
  const [balancePulse, setBalancePulse] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  /* =====================================================
     LOAD WALLET BALANCE
  ===================================================== */

  useEffect(() => {
    const loadBalance = () => {
      const storedCoins = localStorage.getItem("fresherCoins");

      if (storedCoins !== null) {
        const parsedBalance = Number(storedCoins);

        if (Number.isFinite(parsedBalance)) {
          setBalance(parsedBalance);
        }
      } else {
        localStorage.setItem("fresherCoins", "25");
        setBalance(25);
      }
    };

    loadBalance();

    const handleWalletUpdate = () => {
      loadBalance();

      setBalancePulse(true);

      setTimeout(() => {
        setBalancePulse(false);
      }, 900);
    };

    window.addEventListener("fresherCoinsUpdated", handleWalletUpdate);

    window.addEventListener("storage", handleWalletUpdate);

    return () => {
      window.removeEventListener("fresherCoinsUpdated", handleWalletUpdate);

      window.removeEventListener("storage", handleWalletUpdate);
    };
  }, []);

  /* =====================================================
     ACTIVE ROUTE
  ===================================================== */

  const isActive = (path) => location.pathname === path;

  /* =====================================================
     FORMAT BALANCE
  ===================================================== */

  const formattedBalance = Number(balance || 0).toLocaleString("en-IN");

  return (
    <div className="sticky top-0 z-[9999]">
      {/* ===================================================
          HEADER
      =================================================== */}

      <header className="relative overflow-visible border-b border-white/[0.08] bg-black/70 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-[1540px] items-center justify-between px-5 py-4 sm:px-7 lg:px-10">
          {/* =================================================
              LOGO
          ================================================= */}

          <Link
            to="/browse-mentors"
            className="flex items-center gap-3 group shrink-0"
          >
            <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 shadow-[0_0_25px_rgba(139,92,246,0.35)] transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_38px_rgba(139,92,246,0.6)]">
              <Sparkles size={22} className="relative z-10 text-white" />

              <div className="absolute inset-0 transition-opacity duration-300 opacity-0 bg-white/10 group-hover:opacity-100" />

              <div className="absolute top-0 w-8 h-full transition-transform duration-700 -left-10 rotate-12 bg-white/20 blur-md group-hover:translate-x-20" />
            </div>

            <span className="text-xl font-bold tracking-tight text-transparent bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text sm:text-2xl">
              MNCConnect
            </span>
          </Link>

          {/* =================================================
              DESKTOP NAVIGATION
          ================================================= */}

          <nav className="items-center hidden gap-7 lg:flex xl:gap-10">
            <NavItem
              icon={<Home size={18} />}
              label="Home"
              to="/Home"
              active={isActive("/Home")}
            />

            <NavItem
              icon={<CalendarDays size={18} />}
              label="My Bookings"
              to="/my-bookings"
              active={isActive("/my-bookings")}
            />

            <NavItem
              icon={<MessageSquare size={18} />}
              label="Messages"
              to="/messages"
              active={isActive("/Home/notifications")}
            />

            <NavItem
              icon={<LayoutDashboard size={18} />}
              label="Dashboard"
              to="/dashboard"
              active={isActive("/dashboard")}
            />
          </nav>

          {/* =================================================
              RIGHT SIDE
          ================================================= */}

          <div className="flex items-center gap-3 sm:gap-4">
            {/* =================================================
                PREMIUM WALLET
            ================================================= */}

            <button
              type="button"
              onClick={() => navigate("/fresher-profile")}
              className={`
                wallet-shell
                group
                relative
                flex
                items-center
                overflow-hidden
                rounded-2xl
                p-[1px]
                transition-all
                duration-500
                hover:-translate-y-1
                hover:scale-[1.02]
                ${balancePulse ? "scale-105" : ""}
              `}
            >
              {/* =============================================
                  ANIMATED SILVER BORDER
              ============================================= */}

              <span className="absolute inset-0 wallet-border rounded-2xl" />

              {/* =============================================
                  INNER GOLDEN WALLET
              ============================================= */}

              <span className="relative flex items-center overflow-hidden rounded-[15px] border border-amber-300/20 bg-gradient-to-br from-[#3b2705] via-[#76520d] to-[#2a1b03] px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_25px_rgba(245,158,11,0.18)] sm:px-3 sm:py-2">
                {/* GOLD GLOW */}

                <span className="absolute w-24 h-24 transition-all duration-500 rounded-full pointer-events-none -left-10 -top-10 bg-yellow-400/20 blur-2xl group-hover:bg-yellow-300/30" />

                <span className="absolute w-24 h-24 rounded-full pointer-events-none -bottom-10 -right-10 bg-orange-500/20 blur-2xl" />

                {/* =========================================
                    MOVING GOLD SHINE
                ========================================= */}

                <span className="absolute inset-0 pointer-events-none wallet-shine" />

                {/* =========================================
                    WALLET ICON
                ========================================= */}

                <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-yellow-200/30 bg-gradient-to-br from-yellow-300 via-amber-500 to-orange-600 shadow-[inset_0_1px_2px_rgba(255,255,255,0.6),0_0_15px_rgba(245,158,11,0.4)] sm:h-9 sm:w-9">
                  <WalletCards
                    size={17}
                    className="text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]"
                  />

                  {/* SMALL CASH LINE */}

                  <span className="absolute bottom-1 left-1/2 h-[1px] w-3 -translate-x-1/2 rounded-full bg-white/60" />
                </span>

                {/* =========================================
                    BALANCE
                ========================================= */}

                <span className="relative hidden ml-2 text-left sm:block">
                  <span className="block text-[8px] font-black uppercase tracking-[0.24em] text-yellow-200/60">
                    Available Wallet
                  </span>

                  <span className="flex items-center gap-1.5">
                    <span
                      className={`
                        text-sm
                        font-black
                        tracking-tight
                        text-white
                        transition-all
                        duration-500
                        ${balancePulse ? "scale-125 text-yellow-200" : ""}
                      `}
                    >
                      ₹{formattedBalance}
                    </span>

                    <span className="text-[9px] font-bold uppercase tracking-wider text-yellow-300/80">
                      Balance
                    </span>
                  </span>
                </span>

                {/* MOBILE BALANCE */}

                <span
                  className={`
                    relative ml-2 text-xs font-black text-white sm:hidden
                    ${balancePulse ? "scale-125 text-yellow-200" : ""}
                  `}
                >
                  ₹{formattedBalance}
                </span>

                {/* ARROW */}

                <ChevronRight
                  size={14}
                  className="relative hidden ml-1 transition-transform duration-300 text-yellow-200/50 group-hover:translate-x-1 sm:block"
                />

                {/* LIVE STATUS */}

                <span className="absolute flex w-3 h-3 -right-1 -top-1">
                  <span className="absolute inline-flex w-full h-full bg-yellow-400 rounded-full animate-ping opacity-60" />

                  <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-[#171005] bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
                </span>
              </span>
            </button>

            {/* =================================================
                NOTIFICATION
            ================================================= */}

            <button
              type="button"
              className="relative flex items-center justify-center w-10 h-10 transition-all duration-300 group rounded-xl hover:bg-white/5"
            onClick={() => navigate("/Home/notifications")}>
              <Bell
                size={21}
                className="text-gray-300 transition-colors group-hover:text-white"
              />

              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-[10px] font-bold text-white shadow-lg shadow-purple-600/30 ring-2 ring-black">
                3
              </span>
            </button>

            {/* =================================================
                PROFILE
            ================================================= */}

            <button
              type="button"
              onClick={() => navigate("/Home/profile")}
              className="relative h-[3.5rem] w-[3.5rem] overflow-hidden rounded-full border-2 border-purple-500/70 shadow-[0_0_18px_rgba(139,92,246,0.2)] transition-all duration-300 hover:scale-105 hover:border-purple-400 hover:shadow-[0_0_25px_rgba(139,92,246,0.45)]"
            >
              <img
                src={(() => {
                  try {
                    const storedUser = localStorage.getItem("user");

                    if (storedUser) {
                      const user = JSON.parse(storedUser);

                      if (user?.profilePic) {
                        return user.profilePic;
                      }

                      const seed = encodeURIComponent(user?.name || "Fresher");

                      return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${seed}&backgroundColor=4f46e5`;
                    }
                  } catch (error) {
                    console.error(error);
                  }

                  return "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=Fresher&backgroundColor=4f46e5";
                })()}
                alt="Profile"
                className="object-cover w-full h-full"
              />

              <span className="absolute bottom-0 right-0 w-3 h-3 border-2 border-black rounded-full bg-emerald-400" />
            </button>

            {/* =================================================
                MOBILE MENU
            ================================================= */}

            <button
              onClick={() => setMobileMenu((prev) => !prev)}
              className="flex items-center justify-center w-10 h-10 transition border rounded-xl border-white/5 bg-white/5 hover:bg-white/10 lg:hidden"
              aria-label="Toggle menu"
            >
              {mobileMenu ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>

        {/* ===================================================
            MOBILE NAVIGATION
        =================================================== */}

        {mobileMenu && (
          <div className="border-t border-white/10 bg-black/95 backdrop-blur-2xl lg:hidden">
            {/* =================================================
                MOBILE WALLET
            ================================================= */}

            <div className="mx-5 mt-4">
              <button
                onClick={() => {
                  setMobileMenu(false);
                  navigate("/fresher-profile");
                }}
                className="wallet-shell group relative w-full overflow-hidden rounded-2xl p-[1px] text-left"
              >
                <span className="absolute inset-0 wallet-border rounded-2xl" />

                <span className="relative block overflow-hidden rounded-[15px] border border-amber-300/20 bg-gradient-to-br from-[#3b2705] via-[#76520d] to-[#2a1b03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_30px_rgba(245,158,11,0.15)]">
                  <span className="absolute rounded-full pointer-events-none -right-8 -top-8 h-28 w-28 bg-yellow-400/20 blur-2xl" />

                  <span className="absolute inset-0 pointer-events-none wallet-shine" />

                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* WALLET */}

                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-yellow-200/30 bg-gradient-to-br from-yellow-300 via-amber-500 to-orange-600 shadow-[0_0_22px_rgba(245,158,11,0.4)]">
                        <Banknote size={22} className="text-white" />
                      </div>

                      {/* BALANCE */}

                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.24em] text-yellow-200/60">
                          Available Wallet
                        </p>

                        <div className="mt-0.5 flex items-end gap-2">
                          <span
                            className={`
                              text-2xl
                              font-black
                              tracking-tight
                              text-white
                              transition-all
                              duration-500
                              ${balancePulse ? "scale-110 text-yellow-200" : ""}
                            `}
                          >
                            ₹{formattedBalance}
                          </span>

                          <span className="mb-1 text-xs font-bold text-yellow-300/80">
                            Balance
                          </span>
                        </div>
                      </div>
                    </div>

                    <ChevronRight
                      size={19}
                      className="transition-transform duration-300 text-yellow-200/60 group-hover:translate-x-1"
                    />
                  </div>
                </span>
              </button>
            </div>

            {/* =================================================
                MOBILE NAV
            ================================================= */}

            <nav className="flex flex-col gap-2 p-5">
              <MobileNavItem
                icon={<Home size={18} />}
                label="Home"
                to="/"
                active={isActive("/browse-mentors")}
                onClick={() => setMobileMenu(false)}
              />

              <MobileNavItem
                icon={<Users size={18} />}
                label="Browse Mentors"
                to="/browse-mentors"
                active={isActive("/browse-mentors")}
                onClick={() => setMobileMenu(false)}
              />

              <MobileNavItem
                icon={<CalendarDays size={18} />}
                label="My Bookings"
                to="/my-bookings"
                active={isActive("/my-bookings")}
                onClick={() => setMobileMenu(false)}
              />

              <MobileNavItem
                icon={<MessageSquare size={18} />}
                label="Messages"
                to="/messages"
                active={isActive("/messages")}
                onClick={() => setMobileMenu(false)}
              />

              <MobileNavItem
                icon={<LayoutDashboard size={18} />}
                label="Dashboard"
                to="/dashboard"
                active={isActive("/dashboard")}
                onClick={() => setMobileMenu(false)}
              />
            </nav>
          </div>
        )}
      </header>

      {/* =====================================================
          ANIMATIONS
      ===================================================== */}

      <style>{`

        /* ===============================================
           SILVER BORDER TRAVELING EFFECT
        =============================================== */

        @keyframes walletBorderMove {

          0% {
            transform: rotate(0deg);
          }

          100% {
            transform: rotate(360deg);
          }

        }

        .wallet-shell {
          isolation: isolate;
        }

        .wallet-border {
          background:
            conic-gradient(
              from 0deg,
              rgba(255,255,255,0.08),
              rgba(203,213,225,0.25),
              rgba(255,255,255,0.95),
              rgba(148,163,184,0.25),
              rgba(255,255,255,0.08),
              rgba(203,213,225,0.8),
              rgba(255,255,255,0.08)
            );

          animation:
            walletBorderMove
            3.8s
            linear
            infinite;

          filter:
            drop-shadow(
              0 0 5px
              rgba(226,232,240,0.35)
            );

          z-index: -1;
        }

        /* ===============================================
           GOLD SHINE
        =============================================== */

        @keyframes walletShineMove {

          0% {
            transform:
              translateX(-120%)
              skewX(-20deg);

            opacity: 0;
          }

          15% {
            opacity: 0.4;
          }

          45% {
            opacity: 0.8;
          }

          65% {
            opacity: 0;
          }

          100% {
            transform:
              translateX(180%)
              skewX(-20deg);

            opacity: 0;
          }

        }

        .wallet-shine {
          width: 35%;
          background:
            linear-gradient(
              90deg,
              transparent,
              rgba(255,255,255,0.28),
              transparent
            );

          transform:
            translateX(-120%)
            skewX(-20deg);

          animation:
            walletShineMove
            4s
            ease-in-out
            infinite;

        }

        /* ===============================================
           HOVER BORDER BOOST
        =============================================== */

        .wallet-shell:hover .wallet-border {
          animation-duration: 1.8s;

          filter:
            drop-shadow(
              0 0 8px
              rgba(226,232,240,0.65)
            );
        }

      `}</style>
    </div>
  );
};

/* =========================================================
   DESKTOP NAV ITEM
========================================================= */

const NavItem = ({ icon, label, to, active = false }) => {
  return (
    <Link
      to={to}
      className={`
        group
        relative
        flex
        items-center
        gap-2
        transition-all
        duration-200
        ${active ? "text-purple-400" : "text-gray-300 hover:text-white"}
      `}
    >
      {icon}

      <span className="text-sm font-medium">{label}</span>

      {active && (
        <span className="absolute -bottom-[22px] left-0 right-0 h-[2px] rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 shadow-[0_0_10px_rgba(139,92,246,0.7)]" />
      )}
    </Link>
  );
};

/* =========================================================
   MOBILE NAV ITEM
========================================================= */

const MobileNavItem = ({ icon, label, to, active = false, onClick }) => {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`
        flex
        items-center
        gap-3
        rounded-xl
        px-4
        py-3
        transition-all
        duration-200
        ${
          active
            ? "border border-purple-500/10 bg-purple-500/10 text-purple-400"
            : "text-gray-300 hover:bg-white/5 hover:text-white"
        }
      `}
    >
      {icon}

      <span className="font-medium">{label}</span>

      {active && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
      )}
    </Link>
  );
};

export default Header;
