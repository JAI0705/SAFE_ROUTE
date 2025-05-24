import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      <div className="home-content">
        <div className="logo-container">
          <h1 className="logo">Safe Route</h1>
          <p className="tagline">Navigate with confidence in India</p>
        </div>
        
        <div className="description">
          <p>Find the safest routes to your destination with real-time safety updates and community ratings.</p>
        </div>
        
        <div className="auth-buttons">
          <button 
            className="btn btn-register" 
            onClick={() => navigate('/register')}
          >
            Register
          </button>
          <button 
            className="btn btn-signin" 
            onClick={() => navigate('/login')}
          >
            Sign In
          </button>
        </div>
        
        <div className="features">
          <div className="feature">
            <div className="feature-icon">🔒</div>
            <h3>Safety First</h3>
            <p>Routes prioritized by safety ratings</p>
          </div>
          <div className="feature">
            <div className="feature-icon">🗺️</div>
            <h3>Real-time Updates</h3>
            <p>Community-driven safety information</p>
          </div>
          <div className="feature">
            <div className="feature-icon">📱</div>
            <h3>Mobile Ready</h3>
            <p>Access from any device, anywhere</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
