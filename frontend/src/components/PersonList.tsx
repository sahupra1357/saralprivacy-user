import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Person } from '../types/person';
import { deletePerson, getPersons } from '../api/persons';
import PersonForm from './PersonForm';
import Toast from './Toast';

const PersonList: React.FC = () => {
  const [persons, setPersons] = useState<Person[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editPerson, setEditPerson] = useState<Person | null | undefined>(undefined);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPersons = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const data = await getPersons(q);
      setPersons(data);
    } catch {
      setToast({ message: 'Failed to load records', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPersons();
  }, [fetchPersons]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value;
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void fetchPersons(val); }, 300);
  };

  const handleDelete = async (id: string): Promise<void> => {
    if (!window.confirm('Delete this record?')) return;
    try {
      await deletePerson(id);
      setToast({ message: 'Record deleted', type: 'success' });
      void fetchPersons(search);
    } catch {
      setToast({ message: 'Failed to delete', type: 'error' });
    }
  };

  const handleSuccess = (): void => {
    setEditPerson(undefined);
    setToast({ message: 'Saved successfully', type: 'success' });
    void fetchPersons(search);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={handleSearchChange}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={() => setEditPerson(null)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
        >
          + Add New
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : persons.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No records found.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Full Name', 'Email', 'Phone', 'City', 'Country', 'Created At', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {persons.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.full_name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.email}</td>
                  <td className="px-4 py-3 text-gray-600">{p.phone_number ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{p.city ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{p.country ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 flex gap-2">
                    <button
                      onClick={() => setEditPerson(p)}
                      className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { void handleDelete(p.id); }}
                      className="text-red-600 hover:text-red-800 text-xs font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editPerson !== undefined && (
        <PersonForm
          person={editPerson}
          onSuccess={handleSuccess}
          onClose={() => setEditPerson(undefined)}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
};

export default PersonList;
