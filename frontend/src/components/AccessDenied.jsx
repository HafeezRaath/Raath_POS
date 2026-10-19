// QA-060: blank white page ki jagah proper Access Denied page
// (Tailwind + lucide-react — project me MUI dependency nahi hai)
import React from 'react';
import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AccessDenied({ pageName }) {
  const navigate = useNavigate();
  const handleLogout = () => {
    localStorage.removeItem('raath_token');
    localStorage.removeItem('current_user');
    localStorage.removeItem('raath_tenant_id');
    localStorage.removeItem('raath_shop_name');
    window.location.href = '/login';
  };
  return (
    <div className="flex items-center justify-center min-h-[70vh] p-6">
      <div className="bg-white shadow-lg rounded-2xl p-8 max-w-md w-full text-center">
        <Lock className="w-14 h-14 mx-auto mb-4 text-amber-500" />
        <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
        <p className="text-sm text-gray-600 mb-1">
          {pageName
            ? `Aapke role ko "${pageName}" page dekhne ki ijazat nahi hai.`
            : 'Aapke role ko ye page dekhne ki ijazat nahi hai.'}
        </p>
        <p className="text-xs text-gray-400 block mb-6">
          Apne administrator se rabta karein agar aapko access chahiye.
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2 rounded-lg bg-blue-700 text-white font-medium hover:bg-blue-800"
          >
            Dashboard
          </button>
          <button
            onClick={handleLogout}
            className="px-5 py-2 rounded-lg border border-red-500 text-red-600 font-medium hover:bg-red-50"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
