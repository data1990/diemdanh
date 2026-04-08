/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signInWithGoogle } from './firebase';
import { Layout } from './components/Layout';
import { UserCheckIn } from './pages/UserCheckIn';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminMembers } from './pages/AdminMembers';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      setLoginError(null);
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.code === 'auth/unauthorized-domain') {
        setLoginError("Tên miền này chưa được cấp quyền trong Firebase. Vui lòng thêm tên miền vào danh sách Authorized domains trong Firebase Console (Authentication > Settings > Authorized domains).");
      } else if (error.code === 'auth/popup-closed-by-user') {
        setLoginError("Bạn đã đóng cửa sổ đăng nhập trước khi hoàn tất.");
      } else if (error.code === 'auth/popup-blocked') {
        setLoginError("Cửa sổ đăng nhập bị chặn bởi trình duyệt. Vui lòng cho phép hiển thị popup.");
      } else {
        setLoginError(`Đăng nhập thất bại: ${error.message || "Lỗi không xác định"}`);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg text-center space-y-6">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Hệ thống Điểm danh</h1>
          <p className="text-gray-500">Vui lòng đăng nhập để truy cập hệ thống.</p>
          
          {loginError && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 text-left">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{loginError}</p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            Đăng nhập bằng Google
          </button>
        </div>
      </div>
    );
  }

  // Check if user is admin (using the provided email)
  const isAdmin = user.email === 'ngochoang.itqt@gmail.com';

  return (
    <Router>
      <Layout user={user} isAdmin={isAdmin}>
        <Routes>
          <Route path="/" element={<UserCheckIn user={user} />} />
          <Route 
            path="/admin" 
            element={isAdmin ? <AdminDashboard /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/admin/members" 
            element={isAdmin ? <AdminMembers /> : <Navigate to="/" replace />} 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}
