
export interface SubjectRecord {
  subjectName: string;
  grade?: string | number;
  comments?: string;
  behavior?: string;
  absences?: string | number;
  lates?: string | number;
  [key: string]: any; // Capture other columns dynamically
}

export interface Student {
  id: string;
  fullName: string;
  firstName: string;
  phoneNumber?: string;
  language?: string;
  subjects: SubjectRecord[];
  isSelected: boolean;
}

export interface GeneratedMessage {
  studentId: string;
  text: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  timestamp: number;
}

export enum GenerationStyle {
  DETAILED = 'detailed',
  GENERAL = 'general',
  REPORT_CARD = 'report_card',
}

export interface AppState {
  students: Student[];
  messages: Record<string, GeneratedMessage>;
  isProcessing: boolean;
  files: string[];
}

export interface FileData {
  name: string;
  rawParams: any[][];
}

export interface ColumnMapping {
  headerRowIndex: number;
  studentNameIndex: number;
  subjectIndex: number; // -1 if using filename
  gradeOrEventIndex: number;
  justificationIndex: number;
  phoneIndex: number;
}
