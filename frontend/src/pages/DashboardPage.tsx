import React from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import PersonList from '../components/PersonList';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.full_name ?? 'User'}</h1>
          <p className="text-gray-500 mt-1">Manage your PII records below.</p>
        </div>
        <PersonList />
      </main>
    </div>
  );
};

export default DashboardPage;
