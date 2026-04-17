/**
 * Global Configuration for AeroSync
 * Replace the production URL once you deploy your backend to Render.
 */
export const CONFIG = {
    API_BASE: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5000' 
        : 'https://tr-001-elementals-1.onrender.com' // <-- REACH OUT: Replace this after Render deployment
};
