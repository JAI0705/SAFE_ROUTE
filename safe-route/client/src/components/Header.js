import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { logoutUser } from '../services/authService';

const Header = () => {
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
    <header style={{
      backgroundColor: '#4285f4',
      color: 'white',
      boxShadow: '0 3px 10px rgba(0,0,0,0.15)',
      position: 'relative',
      zIndex: 1000,
      width: '100%',
      height: '60px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0 20px',
      borderBottom: '1px solid rgba(255,255,255,0.2)'
    }}>
      {/* Logo and title */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ 
          backgroundColor: 'rgba(255,255,255,0.15)', 
          borderRadius: '50%', 
          width: '36px', 
          height: '36px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          marginRight: '12px'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '22px', width: '22px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <h1 style={{ fontSize: '20px', fontWeight: '600', margin: 0, letterSpacing: '0.5px' }}>Safe Route</h1>
      </div>

      {/* Right side elements */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div className="country-badge" style={{ 
          backgroundColor: 'rgba(255,255,255,0.2)', 
          padding: '6px 12px', 
          borderRadius: '20px', 
          marginRight: '16px',
          fontSize: '14px',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '14px', width: '14px', marginRight: '6px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>India</span>
        </div>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.1)',
          padding: '6px 12px',
          borderRadius: '6px',
          fontSize: '14px',
          marginRight: '12px'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '16px', width: '16px', marginRight: '6px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="user-email">{currentUser ? currentUser.email : 'jaitkens2010@gmail.com'}</span>
        </div>
        
        <button 
          onClick={handleLogout}
          style={{
            backgroundColor: 'rgba(255,255,255,0.15)',
            border: 'none',
            color: 'white',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            transition: 'background-color 0.2s'
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '16px', width: '16px', marginRight: '6px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </header>
  );
};

export default Header;
