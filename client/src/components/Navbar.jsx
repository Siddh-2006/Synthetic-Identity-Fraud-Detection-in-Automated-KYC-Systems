import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, User, LogIn, Menu, LogOut } from 'lucide-react';
import useAuthStore from '../store/authStore';

const Navbar = () => {
  const location = useLocation();
  const { isAuthenticated, logout, user } = useAuthStore();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  return (
    <nav className="fixed top-0 w-full z-100 backdrop-blur-md bg-bg-dark/60 border-b border-border">
      <div className="container-custom h-[70px] flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-primary to-secondary">
            <ShieldCheck size={20} color="white" />
          </div>
          <span className="text-xl font-bold tracking-tighter">
            Deep<span className="gradient-text">KYC</span>
          </span>
        </Link>

        {/* Links - Show when logged in or on landing page */}
        {!isAuthPage && (
          <div className="flex gap-8 items-center">
            {isAuthenticated && (
              <>
                <Link to="/kyc" className="text-text-muted font-medium transition-colors duration-200 hover:text-white">
                  Verification
                </Link>
                <Link to="/profile" className="text-text-muted font-medium transition-colors duration-200 hover:text-white">
                  Profile
                </Link>
              </>
            )}
          </div>
        )}

        {/* Auth Buttons */}
        <div className="flex gap-4 items-center">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-text-muted">Hi, {user?.name?.split(' ')[0]}</span>
              <button onClick={logout} className="btn-outline py-2 px-4 text-sm flex items-center gap-2">
                <LogOut size={16} /> Logout
              </button>
            </>
          ) : !isAuthPage ? (
            <>
              <Link to="/login" className="btn-outline py-2 px-4 text-sm">
                Login
              </Link>
              <Link to="/signup" className="btn-primary py-2 px-4 text-sm">
                Get Started
              </Link>
            </>
          ) : (
            <Link to="/" className="text-text-muted hover:text-white transition-colors">Back to Home</Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
