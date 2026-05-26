import { createContext, useContext } from 'react';
import { BrandConfig } from '../config/brands';

interface AuthContextType {
  token: string | null;
  setToken: (token: string | null) => void;
  selectedBrand: BrandConfig | null;
  setSelectedBrand: (brand: BrandConfig | null) => void;
}

export const AuthContext = createContext<AuthContextType>({
  token: null,
  setToken: () => {},
  selectedBrand: null,
  setSelectedBrand: () => {},
});

export const useAuth = () => useContext(AuthContext);
