import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import App from '../App';
import '../styles/MapPage.css';

const MapPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      // If not authenticated, redirect to login page
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="map-page">
      <App />
    </div>
  );
};

export default MapPage;
