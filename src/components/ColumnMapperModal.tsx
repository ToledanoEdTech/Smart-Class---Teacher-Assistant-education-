
import React, { useState, useEffect } from 'react';
import { ColumnMapping } from '../types';

interface ColumnMapperModalProps {
  fileName: string;
  rawData: any[][];
  initialMapping: ColumnMapping;
  onConfirm: (mapping: ColumnMapping) => void;
  onCancel: () => void;
}

export const ColumnMapperModal: React.FC<ColumnMapperModalProps> = ({ 
    fileName, rawData, initialMapping, onConfirm, onCancel 
}) => {
  const [mapping, setMapping] = useState<ColumnMapping>(initialMapping);
  
  // Headers depend on the selected header row
  const headers = rawData[mapping.headerRowIndex] || [];
  
  const previewRows = rawData.slice(mapping.headerRowIndex + 1, mapping.headerRowIndex + 6);

  const handleSave = () => {
    if (mapping.studentNameIndex === -1) {
        alert("חובה לבחור עמודה עבור 'שם התלמיד'");
        return;
    }
    onConfirm(mapping);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-slate-500 bg-opacity-75 transition-opacity" onClick={onCancel}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-xl text-right overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full">
          <div className="bg-indigo-600 px-4 py-3 sm:px-6">
             <h3 className="text-lg leading-6 font-bold text-white">מיפוי עמודות לקובץ: {fileName}</h3>
             <p className="text-indigo-200 text-xs mt-1">אנא וודא שהמערכת זיהתה נכון את העמודות בקובץ שלך</p>
          </div>
          
          <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4 space-y-6">
            
            {/* 1. Header Row Selection */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">1. בחר את שורת הכותרת (השורה שמכילה את שמות העמודות)</label>
                <div className="border rounded-md overflow-hidden max-h-32 overflow-y-auto bg-slate-50 text-xs">
                    <table className="min-w-full divide-y divide-slate-200">
                        <tbody className="divide-y divide-slate-200">
                            {rawData.slice(0, 8).map((row, idx) => (
                                <tr 
                                    key={idx} 
                                    onClick={() => setMapping({...mapping, headerRowIndex: idx})}
                                    className={`cursor-pointer hover:bg-indigo-50 transition-colors ${mapping.headerRowIndex === idx ? 'bg-indigo-100 ring-2 ring-inset ring-indigo-500' : ''}`}
                                >
                                    <td className="px-2 py-1 font-mono text-slate-400 w-8">{idx + 1}</td>
                                    {row.slice(0, 6).map((cell: any, cIdx: number) => (
                                        <td key={cIdx} className="px-2 py-1 truncate max-w-[100px]">{cell}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 2. Column Mapping */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">2. התאם את העמודות</label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    
                    {/* Student Name */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">שם התלמיד <span className="text-red-500">*</span></label>
                        <select 
                            className="block w-full text-sm border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            value={mapping.studentNameIndex}
                            onChange={(e) => setMapping({...mapping, studentNameIndex: Number(e.target.value)})}
                        >
                            <option value={-1}>-- בחר עמודה --</option>
                            {headers.map((h, i) => (
                                <option key={i} value={i}>{h || `עמודה ${i+1}`}</option>
                            ))}
                        </select>
                    </div>

                    {/* Subject */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">מקצוע (אופציונלי)</label>
                        <select 
                            className="block w-full text-sm border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            value={mapping.subjectIndex}
                            onChange={(e) => setMapping({...mapping, subjectIndex: Number(e.target.value)})}
                        >
                            <option value={-1}>-- השתמש בשם הקובץ --</option>
                            {headers.map((h, i) => (
                                <option key={i} value={i}>{h || `עמודה ${i+1}`}</option>
                            ))}
                        </select>
                    </div>

                    {/* Grade / Event */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">ציון / סוג אירוע</label>
                        <select 
                            className="block w-full text-sm border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            value={mapping.gradeOrEventIndex}
                            onChange={(e) => setMapping({...mapping, gradeOrEventIndex: Number(e.target.value)})}
                        >
                            <option value={-1}>-- ללא --</option>
                            {headers.map((h, i) => (
                                <option key={i} value={i}>{h || `עמודה ${i+1}`}</option>
                            ))}
                        </select>
                    </div>
                    
                    {/* Justification */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">הצדקה (לסינון מוצדקים)</label>
                        <select 
                            className="block w-full text-sm border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            value={mapping.justificationIndex}
                            onChange={(e) => setMapping({...mapping, justificationIndex: Number(e.target.value)})}
                        >
                            <option value={-1}>-- ללא --</option>
                            {headers.map((h, i) => (
                                <option key={i} value={i}>{h || `עמודה ${i+1}`}</option>
                            ))}
                        </select>
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">טלפון (אופציונלי)</label>
                        <select 
                            className="block w-full text-sm border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            value={mapping.phoneIndex}
                            onChange={(e) => setMapping({...mapping, phoneIndex: Number(e.target.value)})}
                        >
                            <option value={-1}>-- ללא --</option>
                            {headers.map((h, i) => (
                                <option key={i} value={i}>{h || `עמודה ${i+1}`}</option>
                            ))}
                        </select>
                    </div>

                </div>
            </div>

            {/* 3. Preview */}
            <div>
                 <label className="block text-sm font-medium text-slate-700 mb-2">3. תצוגה מקדימה (5 שורות ראשונות)</label>
                 <div className="overflow-x-auto border rounded-md">
                     <table className="min-w-full divide-y divide-slate-200 text-xs text-right">
                         <thead className="bg-slate-50">
                             <tr>
                                 {headers.map((h, i) => (
                                     <th key={i} className={`px-3 py-2 text-slate-500 font-medium whitespace-nowrap ${i === mapping.studentNameIndex ? 'bg-indigo-50 text-indigo-700' : ''}`}>
                                         {h}
                                         {i === mapping.studentNameIndex && <span className="block text-[10px] text-indigo-600">(שם תלמיד)</span>}
                                         {i === mapping.subjectIndex && <span className="block text-[10px] text-green-600">(מקצוע)</span>}
                                     </th>
                                 ))}
                             </tr>
                         </thead>
                         <tbody className="bg-white divide-y divide-slate-200">
                             {previewRows.map((row, rIdx) => (
                                 <tr key={rIdx}>
                                     {row.map((cell: any, cIdx: number) => (
                                        <td key={cIdx} className="px-3 py-2 whitespace-nowrap text-slate-600">{cell}</td>
                                     ))}
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                 </div>
            </div>

          </div>
          
          <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
            <button
              type="button"
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
              onClick={handleSave}
            >
              אשר וטע טבלה
            </button>
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              onClick={onCancel}
            >
              דלג על קובץ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
