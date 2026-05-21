import { useState, type ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import type { StaffOutletContext } from "./staffOutletContext";

const staffNavItems: {
  to: string;
  label: string;
  end?: boolean;
  icon: ReactNode;
}[] = [
  {
    to: "/staff",
    label: "Bảng điều khiển",
    end: true,
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    to: "/staff/places",
    label: "Địa điểm",
    end: true,
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    to: "/staff/feedback",
    label: "Đánh giá & phản hồi",
    end: true,
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
  {
    to: "/staff/experience-reports",
    label: "Report địa điểm",
    end: true,
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
    ),
  },
  {
    to: "/staff/journeys/new",
    label: "Tạo trải nghiệm",
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
];

export default function StaffLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex bg-[#fdf8ee] font-['Lato',system-ui,sans-serif] text-stone-800">
      <aside
        className={`shrink-0 border-r border-stone-200/80 bg-white/80 backdrop-blur-sm flex flex-col transition-[width] duration-300 ease-out z-20 ${
          sidebarCollapsed ? "w-[72px]" : "w-[220px]"
        }`}
      >
        <div className={`flex items-center gap-2 px-3 py-4 border-b border-stone-100 ${sidebarCollapsed ? "justify-center" : ""}`}>
          <div className="w-9 h-9 rounded-full bg-[#c5a070] flex items-center justify-center shadow-sm shrink-0 text-white text-sm font-bold font-['Cormorant_Garamond',serif]">
            J
          </div>
          {!sidebarCollapsed && (
            <span className="text-sm font-semibold tracking-wide text-stone-700 truncate">Journey Sense</span>
          )}
        </div>

        <p className={`px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400 ${sidebarCollapsed ? "sr-only" : ""}`}>
          Nhân viên
        </p>

        <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
          {staffNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={sidebarCollapsed ? item.label : undefined}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-amber-50 text-amber-800" : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                } ${sidebarCollapsed ? "justify-center px-2" : ""}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? "text-amber-600" : "text-stone-500"}>{item.icon}</span>
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-2 border-t border-stone-100 space-y-1">
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className={`w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-stone-600 hover:bg-stone-50 transition-colors ${
              sidebarCollapsed ? "justify-center" : ""
            }`}
            title={sidebarCollapsed ? "Mở sidebar" : "Thu sidebar"}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sidebarCollapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5v14" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19v-14" />
              )}
            </svg>
            {!sidebarCollapsed && <span>Thu gọn</span>}
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Outlet context={{ sidebarCollapsed, setSidebarCollapsed } satisfies StaffOutletContext} />
      </div>
    </div>
  );
}
