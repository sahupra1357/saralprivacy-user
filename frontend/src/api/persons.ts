import axiosInstance from './axiosInstance';
import type { Person, PersonCreate, PersonUpdate } from '../types/person';

export async function getPersons(search?: string): Promise<Person[]> {
  const params = search ? { search } : {};
  const res = await axiosInstance.get<Person[]>('/persons', { params });
  return res.data;
}

export async function getPerson(id: string): Promise<Person> {
  const res = await axiosInstance.get<Person>(`/persons/${id}`);
  return res.data;
}

export async function createPerson(data: PersonCreate): Promise<Person> {
  const res = await axiosInstance.post<Person>('/persons', data);
  return res.data;
}

export async function updatePerson(id: string, data: PersonUpdate): Promise<Person> {
  const res = await axiosInstance.put<Person>(`/persons/${id}`, data);
  return res.data;
}

export async function deletePerson(id: string): Promise<void> {
  await axiosInstance.delete(`/persons/${id}`);
}
