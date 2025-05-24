import React from 'react';
import { useNavigate } from 'react-router-dom';
import { logoutUser } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import '../styles/AuthNav.css';

const AuthNav = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const handleLogout = async () => {
    try {
      const result = await logoutUser();
      if (result.success) {
        navigate('/');
      } else {
        console.error('Logout failed:', result.error);
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  
  return (
    <div className="auth-nav">
      {currentUser && (
        <div className="user-info">
          <span className="user-email">{currentUser.email}</span>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default AuthNav;
