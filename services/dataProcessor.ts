import { Student, SubjectRecord } from '../types';
import * as XLSX from 'xlsx';

const NAME_HEADERS = [
  'name', 'student', 'student name', 'full name', 'firstname', 'lastname',
  'שם', 'שם תלמיד', 'שם מלא', 'התלמיד', 'שם ושם משפחה',
  'שם התלמיד/ה', 'פרטי תלמיד', 'שמות', 'שם פרטי', 'שם משפחה'
];

const PHONE_HEADERS = [
  'phone', 'cell', 'mobile', 'parent phone', 'contact',
  'טלפון', 'נייד', 'מספר טלפון', 'פלאפון', 'טלפון נייד', 'טלפון הורים', 'סלולרי', 'נייד הורים', 'נייד אב', 'נייד אם'
];

// Keywords that indicate a row is NOT a student data row
const INVALID_ROW_KEYWORDS = [
  // Stats & Metadata
  'ממוצע', 'סה"כ', 'סיכום', 'total', 'average', 'count', 'min', 'max', 'std', 'grand total',
  
  // Staff
  'מורה', 'צוות', 'הנהלה', 'teacher', 'staff', 'מחנך', 'מחנכת', 'סייעת', 'רכזת', 'מנהלת', 'מנהל', 'מלמד',
  
  // School Subjects & Events (Specific user requests included)
  'תפילה', 'תפילת', 'מנחה', 'שחרית', 'תפילת מנחה', 'תפילת שחרית',
  'פרטני', 'שעות פרטני', 'תיגבור', 'תגבור', 'קבוצה',
  'חינוך', 'שעת חינוך', 'שיעור חינוך',
  'גמרא', 'משנה', 'נביא', 'תורה', 'חומש', 'דינים', 'הלכה', 'יהדות', 'מחשבת ישראל', 'פרשת שבוע', 'ביאור תפילה', 'תושב"ע',
  'מתמטיקה', 'חשבון', 'הנדסה', 'גיאומטריה', 'אנגלית', 'english', 'מדעים', 'פיזיקה', 'כימיה', 'ביולוגיה', 
  'היסטוריה', 'אזרחות', 'גיאוגרפיה', 'מולדת', 'ספרות', 'לשון', 'עברית', 'הבעה', 'שפה', 'כתיבה', 'קריאה',
  'ספורט', 'חינוך גופני', 'חנ"ג', 'אומנות', 'מוזיקה', 'מחשבים', 'טכנולוגיה', 'סייבר', 'תקשוב',
  'מקצוע', 'subject', 'כיתה', 'class', 'שכבה', 'grade'
];

const cleanStr = (str: any): string => String(str || '').trim().toLowerCase();

/**
 * Finds the index of the row that is most likely the Header Row.
 * Strategy: Look for specific keywords. If fail, look for the row with the most non-empty string cells.
 */
const findHeaderRowIndex = (data: any[][]): number => {
  let bestRowIndex = 0;
  let maxScore = -1;

  for (let i = 0; i < Math.min(data.length, 50); i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    let score = 0;
    // Boost score if contains known headers
    if (row.some(cell => NAME_HEADERS.includes(cleanStr(cell)))) score += 10;
    if (row.some(cell => PHONE_HEADERS.includes(cleanStr(cell)))) score += 5;

    // Count non-empty text cells
    const textCells = row.filter(c => c && typeof c === 'string' && c.trim().length > 1).length;
    score += textCells;

    if (score > maxScore) {
      maxScore = score;
      bestRowIndex = i;
    }
  }
  
  // If no good header found, assume row 0 if it has data
  return maxScore > 0 ? bestRowIndex : 0;
};

/**
 * Heuristic to find the Name column index if explicit headers fail.
 * Scans columns to find one that has text values (Hebrew/English) and isn't numeric.
 */
const detectNameColumnIndex = (data: any[][], headerRowIdx: number, headers: string[]): number => {
  if (data.length <= headerRowIdx + 1) return -1;

  const numCols = data[headerRowIdx]?.length || 0;
  let bestCol = -1;
  let maxScore = -1;

  // Check columns
  for (let col = 0; col < numCols; col++) {
    // Skip columns that look like Teacher columns in the header (even if using heuristic fallback)
    const headerName = cleanStr(headers[col]);
    if (headerName.includes('מורה') || headerName.includes('teacher') || headerName.includes('מחנך') || headerName.includes('מלמד')) continue;

    let score = 0;
    let checkedRows = 0;

    // Sample up to 20 rows
    for (let row = headerRowIdx + 1; row < Math.min(data.length, headerRowIdx + 20); row++) {
       const val = data[row]?.[col];
       if (!val) continue;

       const strVal = String(val).trim();
       if (strVal.length < 2) continue; // Skip short garbage
       
       checkedRows++;

       // Penalty for numbers (grades, IDs)
       if (/^[\d.,%-]+$/.test(strVal)) {
          score -= 10;
       } 
       // Bonus for Hebrew/Text
       else if (/[\u0590-\u05FFa-zA-Z ]+/.test(strVal)) {
          // Penalty if it looks like a teacher's name column (repeated "Teacher" keyword in data)
          if (strVal.includes('מורה') || strVal.includes('Teacher')) {
              score -= 20;
          } else {
              score += 2;
          }
       }
    }

    if (checkedRows > 0 && score > maxScore) {
      maxScore = score;
      bestCol = col;
    }
  }

  // Threshold: Score must be positive to be considered a name column
  return maxScore > 0 ? bestCol : -1;
};

const extractSubjectFromFileName = (fileName: string): string => {
  return fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
};

export const processFiles = async (files: File[]): Promise<Student[]> => {
  const studentMap = new Map<string, Student>();

  for (const file of files) {
    try {
      const fileNameSubject = extractSubjectFromFileName(file.name);
      const rawData = await parseFileToRawArrays(file);
      if (!rawData || rawData.length === 0) continue;

      const headerRowIndex = findHeaderRowIndex(rawData);
      const headerRow = rawData[headerRowIndex] || [];
      const dataRows = rawData.slice(headerRowIndex + 1);

      // Map headers
      let headers = headerRow.map((h, i) => {
        const val = String(h || '').trim();
        return val || `עמודה ${i + 1}`;
      });

      // 1. Try to find Name column by Header
      let nameIdx = -1;
      
      // Strict search: Must match known Name headers AND NOT contain 'Teacher'
      for (let i = 0; i < headers.length; i++) {
          const h = cleanStr(headers[i]);
          // Safety check: ensure it's not a teacher column
          if (h.includes('מורה') || h.includes('teacher') || h.includes('מחנך')) continue;

          if (NAME_HEADERS.includes(h)) {
              nameIdx = i;
              break;
          }
      }
      
      // 2. Fallback: Detect Name column by content
      if (nameIdx === -1) {
          nameIdx = detectNameColumnIndex(rawData, headerRowIndex, headers);
      }

      // If still not found, skip file
      if (nameIdx === -1) {
          console.warn(`Could not identify name column in file: ${file.name}`);
          continue;
      }

      // Find Phone column
      const phoneIdx = headers.findIndex(h => PHONE_HEADERS.some(ph => cleanStr(h).includes(ph)));

      // --- Process Rows ---
      dataRows.forEach((row) => {
        const rawName = row[nameIdx];
        if (!rawName) return;

        const fullName = String(rawName).trim();
        const lowerName = fullName.toLowerCase();

        // --- Strict Filtering ---
        if (fullName.length < 2) return;
        
        // Skip Invalid Keywords (Summary rows, Teachers, Subjects, Total)
        if (INVALID_ROW_KEYWORDS.some(k => lowerName.includes(k))) return;
        
        // Skip if row name matches a header name (repetitive headers)
        if (NAME_HEADERS.includes(lowerName)) return; 
        
        // Skip Numeric Names (IDs, Phones interpreted as names)
        if (/^\d+$/.test(fullName.replace(/[- ]/g, ''))) return; 
        
        // Skip if name looks like a generic title "The Teacher"
        if (lowerName.startsWith('המורה') || lowerName.startsWith('teacher')) return;
        // ------------------------

        let student = studentMap.get(fullName);
        if (!student) {
          student = {
            id: crypto.randomUUID(),
            fullName: fullName,
            firstName: fullName.split(' ').pop() || fullName, // Fallback heuristic
            subjects: [],
            isSelected: true
          };
          studentMap.set(fullName, student);
        }

        // Update Phone if missing and available
        if (!student.phoneNumber && phoneIdx !== -1 && row[phoneIdx]) {
           student.phoneNumber = String(row[phoneIdx]).replace(/[^0-9+]/g, '');
        }

        // Create record
        const record: SubjectRecord = { subjectName: fileNameSubject };
        
        row.forEach((cell, idx) => {
           if (idx === nameIdx || idx === phoneIdx) return; 
           if (cell === undefined || cell === null || cell === '') return;

           let headerName = headers[idx];
           // Ensure the header doesn't look like a teacher column for the data record either
           const cleanHeader = cleanStr(headerName);
           if (cleanHeader.includes('מורה') || cleanHeader.includes('מחנך')) return;

           record[headerName] = cell;
        });

        student.subjects.push(record);
      });

    } catch (error) {
      console.error(`Error processing ${file.name}`, error);
    }
  }

  return Array.from(studentMap.values());
};

const parseFileToRawArrays = (file: File): Promise<any[][]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Use header:1 to get raw array of arrays
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
        resolve(jsonData);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};