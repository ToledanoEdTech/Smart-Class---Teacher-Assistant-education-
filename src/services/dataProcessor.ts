import { Student, SubjectRecord, ColumnMapping } from '../types';
import * as XLSX from 'xlsx';

// Strong keywords to identify the header row - Prioritizing "Student Name"
const HEADER_SIGNATURES = [
  'שם תלמיד', 'שם מלא', 'שם פרטי', 'student name', 'name', 'תלמיד'
];

// Aggressive cleanup helper
const cleanStr = (str: any): string => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/[\uFEFF\u200B]/g, '') // Remove BOM and zero-width spaces
    .trim();
};

export const readFileToRawData = (file: File): Promise<any[][]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        // header: 1 returns raw array of arrays [ [], [], [] ]
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

const findHeaderRow = (data: any[][]): number => {
  // Scan first 30 rows to find the one containing "Student Name"
  const limit = Math.min(data.length, 30);
  
  for (let i = 0; i < limit; i++) {
    const row = data[i];
    if (!Array.isArray(row) || row.length === 0) continue;

    const rowStr = row.map(c => cleanStr(c).toLowerCase());

    // Strict check: The row MUST contain a column that looks like "Student Name"
    if (HEADER_SIGNATURES.some(sig => rowStr.includes(sig))) {
        return i;
    }
  }

  // Fallback: finding row with most data if explicit name column not found (less likely)
  let bestRow = 0;
  let maxCols = 0;
  for (let i = 0; i < limit; i++) {
     const cols = data[i].filter(c => cleanStr(c).length > 0).length;
     if (cols > maxCols) {
         maxCols = cols;
         bestRow = i;
     }
  }
  return bestRow;
};

export const guessMapping = (rawData: any[][]): ColumnMapping => {
    const headerRowIdx = findHeaderRow(rawData);
    
    const mapping: ColumnMapping = {
        headerRowIndex: headerRowIdx !== -1 ? headerRowIdx : 0,
        studentNameIndex: -1,
        subjectIndex: -1,
        gradeOrEventIndex: -1,
        justificationIndex: -1,
        phoneIndex: -1
    };

    if (headerRowIdx === -1 || !rawData[headerRowIdx]) return mapping;

    const headers = rawData[headerRowIdx].map(h => cleanStr(h));
    const findIdx = (terms: string[]) => headers.findIndex(h => terms.some(t => h.toLowerCase().includes(t)));

    // 1. Student Name
    mapping.studentNameIndex = headers.findIndex(h => {
        const lower = h.toLowerCase();
        const isName = ['שם תלמיד', 'שם מלא', 'student name', 'name', 'תלמיד'].some(k => lower.includes(k));
        // Ensure it's not a teacher column
        const isTeacher = lower.includes('מורה') || lower.includes('teacher') || lower.includes('מחנך');
        return isName && !isTeacher;
    });

    // 2. Subject
    mapping.subjectIndex = findIdx(['מקצוע', 'subject']);

    // 3. Grade or Event Type
    mapping.gradeOrEventIndex = findIdx(['ציון', 'סוג אירוע', 'grade', 'event', 'mark', 'score', 'behavior', 'התנהגות', 'תיאור']);

    // 4. Justification
    mapping.justificationIndex = findIdx(['הצדקה', 'justifi', 'סיבה', 'reason', 'status', 'סטטוס']);

    // 5. Phone
    mapping.phoneIndex = findIdx(['טלפון', 'phone', 'mobile', 'נייד']);

    return mapping;
};

export const processStudentDataWithMapping = (
    rawData: any[][], 
    mapping: ColumnMapping, 
    fileName: string, 
    existingStudents: Student[]
): Student[] => {
    const studentMap = new Map<string, Student>();
    existingStudents.forEach(s => studentMap.set(s.fullName, s));

    const defaultSubject = fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim();
    const headers = rawData[mapping.headerRowIndex] || [];
    
    // Clean headers for object keys
    const cleanHeaders = headers.map(h => cleanStr(h));

    let lastStudentName: string | null = null;

    for (let i = mapping.headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;

        // Extract Name
        let studentName = '';
        if (mapping.studentNameIndex !== -1) {
            studentName = cleanStr(row[mapping.studentNameIndex]);
        }

        // Forward Fill Logic for Merged Cells
        const hasData = row.some((c: any) => cleanStr(c).length > 0);
        
        if (studentName.length < 2 && hasData && lastStudentName) {
            studentName = lastStudentName;
        } else if (studentName.length >= 2) {
             // Filter junk rows
             if (['סה"כ', 'ממוצע', 'total', 'average', 'סיכום'].some(k => studentName.includes(k))) {
                lastStudentName = null; 
                continue;
            }
            if (studentName.startsWith('המורה') || studentName.toLowerCase().includes('teacher')) {
                lastStudentName = null;
                continue;
            }
            lastStudentName = studentName;
        } else {
            continue;
        }

        let student = studentMap.get(studentName);
        if (!student) {
            student = {
                id: crypto.randomUUID(),
                fullName: studentName,
                firstName: studentName.split(' ').pop() || studentName,
                subjects: [],
                isSelected: true
            };
            studentMap.set(studentName, student);
        }

        // Phone
        if (mapping.phoneIndex !== -1 && !student.phoneNumber) {
            const rawPhone = cleanStr(row[mapping.phoneIndex]);
            if (rawPhone.length > 6) student.phoneNumber = rawPhone.replace(/[^0-9+]/g, '');
        }

        // Subject Logic
        let subjectName = defaultSubject;
        if (mapping.subjectIndex !== -1) {
            const rowSub = cleanStr(row[mapping.subjectIndex]);
            if (rowSub.length > 1) subjectName = rowSub;
        }

        // Create Record
        const record: SubjectRecord = { subjectName };

        cleanHeaders.forEach((h: string, idx: number) => {
             // Skip index columns
             if (idx === mapping.studentNameIndex || idx === mapping.phoneIndex) return;
             
             // 1. Ghost Column Removal
             if (!h || h.toLowerCase().startsWith('unnamed')) return;

             const cellVal = row[idx];
             if (cellVal !== undefined && cellVal !== null && cellVal !== '') {
                 record[h] = cellVal;
             }
        });
        
        student.subjects.push(record);
    }

    return Array.from(studentMap.values());
};
