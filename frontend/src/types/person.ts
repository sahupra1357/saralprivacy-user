export interface Person {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonCreate {
  full_name: string;
  email: string;
  phone_number?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  national_id?: string;
}

export type PersonUpdate = Partial<PersonCreate>;
