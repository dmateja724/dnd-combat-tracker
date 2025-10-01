import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import CombatTracker from './components/CombatTracker';
import SignInPage from './pages/SignIn';
import SignUpPage from './pages/SignUp';
import { useAuth } from './context/AuthContext';
const LoadingScreen = () => (_jsx("div", { className: "auth-shell", children: _jsxs("div", { className: "auth-card", children: [_jsx("h1", { children: "Loading\u2026" }), _jsx("p", { className: "auth-subtitle", children: "Preparing your adventuring party." })] }) }));
const RequireAuth = ({ children }) => {
    const { user, isLoading, isBootstrapping } = useAuth();
    const location = useLocation();
    if (isBootstrapping) {
        return _jsx(LoadingScreen, {});
    }
    if (!user) {
        return _jsx(Navigate, { to: "/login", replace: true, state: { from: location } });
    }
    if (isLoading) {
        return _jsx(LoadingScreen, {});
    }
    return children;
};
const GuestOnly = ({ children }) => {
    const { user, isLoading, isBootstrapping } = useAuth();
    if (isBootstrapping) {
        return _jsx(LoadingScreen, {});
    }
    if (user) {
        return _jsx(Navigate, { to: "/", replace: true });
    }
    if (isLoading) {
        return _jsx(LoadingScreen, {});
    }
    return children;
};
const App = () => {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(RequireAuth, { children: _jsx(CombatTracker, {}) }) }), _jsx(Route, { path: "/login", element: _jsx(GuestOnly, { children: _jsx(SignInPage, {}) }) }), _jsx(Route, { path: "/signup", element: _jsx(GuestOnly, { children: _jsx(SignUpPage, {}) }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }));
};
export default App;
