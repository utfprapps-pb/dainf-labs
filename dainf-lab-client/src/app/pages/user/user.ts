import { Identifiable } from "@/shared/crud/crud";
import { Group } from '../group/group';

export interface User extends Identifiable {
  id: number;
  email?: string;
  password?: string;
  nome?: string;
  telefone?: string;
  documento?: string;
  role?: string;
  enabled?: boolean;
  emailVerificado?: boolean;
  groups?: Group[];
}
