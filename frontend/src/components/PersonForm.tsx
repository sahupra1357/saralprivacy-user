import React, { useState } from 'react';
import type { Person, PersonCreate, PersonUpdate } from '../types/person';
import { createPerson, updatePerson } from '../api/persons';

interface Props {
  person: Person | null;
  onSuccess: () => void;
  onClose: () => void;
}

const PersonForm: React.FC<Props> = ({ person, onSuccess, onClose }) => {
  const [form, setForm] = useState<PersonCreate>({
    full_name: person?.full_name ?? '',
    email: person?.email ?? '',
    phone_number: person?.phone_number ?? '',
    address_line1: person?.address_line1 ?? '',
    address_line2: person?.address_line2 ?? '',
    city: person?.city ?? '',
    state: person?.state ?? '',
    postal_code: person?.postal_code ?? '',
    country: person?.country ?? '',
    national_id: '',
  });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim()) {
      setError('Full name and email are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (person) {
        const update: PersonUpdate = { ...form };
        if (!update.national_id) delete update.national_id;
        await updatePerson(person.id, update);
      } else {
        await createPerson(form);
      }
      onSuccess();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fields: Array<{ name: keyof PersonCreate; label: string; required?: boolean }> = [
    { name: 'full_name', label: 'Full Name', required: true },
    { name: 'email', label: 'Email', required: true },
    { name: 'phone_number', label: 'Phone' },
    { name: 'address_line1', label: 'Address Line 1' },
    { name: 'address_line2', label: 'Address Line 2' },
    { name: 'city', label: 'City' },
    { name: 'state', label: 'State' },
    { name: 'postal_code', label: 'Postal Code' },
    { name: 'country', label: 'Country' },
    { name: 'national_id', label: 'National ID' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">{person ? 'Edit Person' : 'Add Person'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <form onSubmit={(e) => { void handleSubmit(e); }} className="p-6 space-y-4">
          {fields.map(({ name, label, required }) => (
            <div key={name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
                {name === 'national_id' && (
                  <span className="ml-2 text-xs text-gray-400" title="Stored as one-way hash — cannot be retrieved">
                    ℹ️ Hashed
                  </span>
                )}
              </label>
              <input
                type={name === 'email' ? 'email' : 'text'}
                name={name}
                value={(form[name] as string | undefined) ?? ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ))}
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PersonForm;
