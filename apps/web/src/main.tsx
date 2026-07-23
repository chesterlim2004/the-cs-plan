import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import "./index.css";
import { AppLayout } from "./pages/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { PlannerPage } from "./pages/PlannerPage";
import { GpaPage } from "./pages/GpaPage";
import { RequirementsPage } from "./pages/RequirementsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AdministratorPage } from "./pages/AdministratorPage";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/onboarding", element: <OnboardingPage /> },
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <PlannerPage /> },
      { path: "planner", element: <PlannerPage /> },
      { path: "gpa", element: <GpaPage /> },
      { path: "requirements", element: <RequirementsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "administrator", element: <AdministratorPage /> }
    ]
  }
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);
