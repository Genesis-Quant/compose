import { lazy, Suspense, useEffect } from "react";
import { AnimatePresence } from "motion/react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { BrandMark } from "@/components/auth/BrandMark";
import { useAppStore } from "@/store";

const LoginPage = lazy(() => import("@/views/LoginPage"));
const AppLayout = lazy(() => import("@/layout/AppLayout"));
const HomePage = lazy(() => import("@/views/HomePage"));
const ProfilePage = lazy(() => import("@/views/ProfilePage"));
const RegisterPage = lazy(() => import("@/views/RegisterPage"));

export default function App() {
  const location = useLocation();
  const authStatus = useAppStore((state) => state.authStatus);
  const restoreSession = useAppStore((state) => state.restoreSession);
  const authenticated = authStatus === "authenticated";

  useEffect(() => { restoreSession(); }, [restoreSession]);
  if (authStatus === "idle" || authStatus === "loading") return <RouteLoading />;

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<RouteLoading />}>
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={authenticated ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/register" element={authenticated ? <Navigate to="/" replace /> : <RegisterPage />} />
          <Route element={authenticated ? <AppLayout /> : <Navigate to="/login" replace />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to={authenticated ? "/" : "/login"} replace />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
}

function RouteLoading() {
  return <div className="grid min-h-screen place-items-center"><div className="flex flex-col items-center gap-5"><BrandMark /><span className="loading-line" /></div></div>;
}
