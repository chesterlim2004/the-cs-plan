import { useQuery } from "@tanstack/react-query";
import { BookOpen, CheckSquare, GraduationCap, LayoutDashboard, Settings } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { GhostButton } from "../components/ui";
import { cn } from "../lib/utils";

const navItems = [
  { to: "/planner", label: "Planner", icon: LayoutDashboard },
  { to: "/requirements", label: "Requirements", icon: CheckSquare },
  { to: "/settings", label: "Settings", icon: Settings }
];

export function AppLayout() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    retry: false
  });

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted">Loading The CS Plan...</div>;
  }

  if (error) {
    navigate("/login");
    return null;
  }

  if (!data?.profile) {
    navigate("/onboarding");
    return null;
  }

  return (
    <div className="min-h-screen bg-surface text-zinc-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-[#0d0f11] p-5 lg:block">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md border border-line bg-panel text-zinc-100">
            <GraduationCap size={22} strokeWidth={2} />
          </div>
          <p className="text-lg font-semibold tracking-tight">The CS Plan</p>
        </div>

        <nav className="mt-8 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted transition hover:bg-white/5 hover:text-zinc-100",
                  isActive && "bg-white/10 text-zinc-100"
                )
              }
            >
              <item.icon size={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-5 left-5 right-5 rounded-lg border border-line bg-panel p-3">
          <div className="flex items-center gap-3">
            {data.user.avatarUrl ? (
              <img src={data.user.avatarUrl} alt="" className="h-9 w-9 rounded-full" />
            ) : (
              <div className="grid h-9 w-9 place-items-center rounded-full bg-zinc-800">
                <BookOpen size={16} />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{data.user.name}</p>
              <p className="truncate text-xs text-muted">{data.user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-line bg-surface/90 px-5 backdrop-blur">
          <div>
            <p className="text-sm font-medium">Computer Science</p>
            <p className="text-xs text-muted">
              {data.profile.cohort} · Graduating in {data.profile.graduationSemester}
            </p>
          </div>
          <GhostButton
            onClick={async () => {
              await api.logout();
              navigate("/login");
            }}
          >
            Log out
          </GhostButton>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
