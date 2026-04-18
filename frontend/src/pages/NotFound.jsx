import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';

const NotFound = () => {
  const navigate = useNavigate();

  const goToDashboard = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <div className="mx-auto h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-4xl font-bold text-gray-600">404</span>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Page not found
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sorry, we couldn't find the page you're looking for.
          </p>
        </div>
        <button
          onClick={goToDashboard}
          className="mt-8 group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-atd-blue hover:bg-[#034d87] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-atd-blue"
        >
          <Home className="w-4 h-4 mr-2" />
          Go to Dashboard
        </button>
      </div>
    </div>
  );
};

export default NotFound;