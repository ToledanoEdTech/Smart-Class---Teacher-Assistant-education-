import React, { useMemo } from 'react';
import { Student } from '../types';

interface TrendsDashboardProps {
  students: Student[];
}

export const TrendsDashboard: React.FC<TrendsDashboardProps> = ({ students }) => {

  const extractScore = (val: any): number => {
    const str = String(val).trim();
    if (/^-?\d+(\.\d+)?$/.test(str)) return parseFloat(str);
    return NaN;
  };

  // Remove common separators and quotes (e.g. סה"כ -> סה כ)
  const normalizeKey = (key: string) => key.toLowerCase().replace(/[-_.\"\']/g, ' ');

  const trends = useMemo(() => {
    // Headers to ignore for grades calculation (Pure metadata or Summary counters)
    const IGNORED_HEADERS = [
        'מס', 'מספר', 'מס.', 'מס\'', 'no', 'no.', 'num', 'id', 'index', 
        'כיתה', 'class', 'שכבה', 'grade level', 'ת.ז', 'tz', 'group', 'קב', 'קבוצה', 'טור',
        'סה"כ', 'סה״כ', 'סך הכל', 'סיכום', 'total', 'sum', 'count', 'amount', 'מונה', 'counter'
    ];
    
    // Non-grade columns
    const NON_GRADE_KEYWORDS = [
        'שיעורי בית', 'ש.ב', 'ש״ב', 'homework', 'hw', 
        'תלבושת', 'uniform', 
        'ציוד', 'equipment', 
        'הערכה', 'eval', 'effort', 
        'התנהגות', 'behavior', 
        'חיסור', 'absence', 'חיסורים',
        'איחור', 'late', 'איחורים',
        'מילה טובה', 'מילים טובות', 
        'הצטיינות', 'הצטיינויות', 'commendation', 
        'נחת', 'חיזוק', 'חיזוקים', 
        'מחמאה', 'מחמאות', 
        'הערות', 'comment', 'note',
        'פרגון', 'נקודות זכות', 'זכות', 'שבח', 'לשבח', 'נקודת אור', 'נקודות אור',
        'אירועים', 'events', 'incident'
    ];

    const results = students.map(s => {
        let allGrades: number[] = [];
        let negativeEvents = 0;
        let positiveEvents = 0;

        s.subjects.forEach(sub => {
            Object.entries(sub).forEach(([key, val]) => {
                if(key === 'subjectName') return;
                
                const lowerKey = normalizeKey(key);
                const strVal = (lowerKey + ' ' + val).toLowerCase();

                // 1. Check for behavior
                let isBehavior = false;
                const isNonGradeHeader = NON_GRADE_KEYWORDS.some(k => lowerKey.includes(k));

                if (['איחור', 'חיסור', 'הפרעה', 'late', 'absence', 'violence', 'ציוד', 'equipment', 'חוצפה', 'שלילי', 'משמעת', 'homework', 'שיעורי בית', 'ש.ב'].some(k => strVal.includes(k) || lowerKey.includes(k))) {
                     // Check if it's a "No/0" for positive things (like HW)
                     if (lowerKey.includes('homework') || lowerKey.includes('שיעורי בית') || lowerKey.includes('ש.ב')) {
                         if (val === 0 || val === 'לא' || strVal.includes('לא')) negativeEvents++;
                     } else {
                         // Regular negative events
                         if (typeof val === 'number' && val > 0) negativeEvents++; // Count if number > 0 (e.g. 3 lates)
                         else if (typeof val === 'string') negativeEvents++; // Text comment
                     }
                     isBehavior = true;
                }
                
                // Negative count check
                if (['אי הכנת', 'לא הכין', 'חוסר', 'missing'].some(k => lowerKey.includes(k))) {
                    if (parseFloat(String(val)) > 0) negativeEvents++;
                    isBehavior = true;
                }

                if (['מילה טובה', 'הצטיינות', 'excellent', 'commendation', 'חיובי', 'נחת', 'חיזוק'].some(k => strVal.includes(k) || lowerKey.includes(k))) {
                     positiveEvents++;
                     isBehavior = true;
                }
                
                // Grade Logic
                const isIgnored = IGNORED_HEADERS.some(h => lowerKey === h || lowerKey.includes(h + ' ') || lowerKey.startsWith(h));
                
                // Guard: If it's a non-grade header (e.g. Mila Tova), skip grade calc
                if (!isBehavior && !isIgnored && !isNonGradeHeader && !lowerKey.includes('מורה')) {
                    const num = extractScore(val);
                    if (!isNaN(num) && num >= 0 && num <= 100) {
                        allGrades.push(num);
                    }
                }
            });
        });

        let trend: 'improving' | 'declining' | 'stable' | 'insufficient' = 'insufficient';
        let diff = 0;

        if (allGrades.length >= 2) {
            const mid = Math.floor(allGrades.length / 2);
            const firstHalf = allGrades.slice(0, mid);
            const secondHalf = allGrades.slice(mid);
            
            const avg1 = firstHalf.reduce((a,b) => a+b, 0) / firstHalf.length;
            const avg2 = secondHalf.reduce((a,b) => a+b, 0) / secondHalf.length;
            
            diff = avg2 - avg1;
            if (diff > 3) trend = 'improving';
            else if (diff < -3) trend = 'declining';
            else trend = 'stable';
        }

        return {
            id: s.id,
            name: s.fullName,
            gradesCount: allGrades.length,
            negativeEvents,
            positiveEvents,
            trend,
            diff,
            avg: allGrades.length > 0 ? (allGrades.reduce((a,b)=>a+b,0)/allGrades.length) : 0
        };
    });

    return results.sort((a,b) => b.avg - a.avg);
  }, [students]);

  // Spotlight Logic
  const topImproving = useMemo(() => trends.filter(t => t.trend === 'improving').sort((a,b) => b.diff - a.diff).slice(0, 3), [trends]);
  const mostDeclining = useMemo(() => trends.filter(t => t.trend === 'declining').sort((a,b) => a.diff - b.diff).slice(0, 3), [trends]);
  const topBehavior = useMemo(() => trends.sort((a,b) => b.positiveEvents - a.positiveEvents).slice(0, 3), [trends]);

  return (
    <div className="space-y-8 pb-12">
        
        {/* Spotlight Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100 shadow-sm">
                <h3 className="text-emerald-800 font-bold mb-3 flex items-center gap-2">
                    <span className="text-xl">📈</span> במגמת עלייה
                </h3>
                <div className="space-y-3">
                    {topImproving.length > 0 ? topImproving.map(t => (
                        <div key={t.id} className="bg-white p-2 rounded-lg shadow-sm flex justify-between items-center text-sm">
                            <span className="font-medium">{t.name}</span>
                            <span className="text-emerald-600 font-bold">+{t.diff.toFixed(1)}</span>
                        </div>
                    )) : <p className="text-sm text-emerald-600/70">לא זוהו תלמידים במגמת עלייה מובהקת</p>}
                </div>
            </div>

            <div className="bg-red-50 rounded-2xl p-5 border border-red-100 shadow-sm">
                <h3 className="text-red-800 font-bold mb-3 flex items-center gap-2">
                    <span className="text-xl">📉</span> דורשים חיזוק (ירידה)
                </h3>
                <div className="space-y-3">
                    {mostDeclining.length > 0 ? mostDeclining.map(t => (
                        <div key={t.id} className="bg-white p-2 rounded-lg shadow-sm flex justify-between items-center text-sm">
                            <span className="font-medium">{t.name}</span>
                            <span className="text-red-600 font-bold">{t.diff.toFixed(1)}</span>
                        </div>
                    )) : <p className="text-sm text-red-600/70">לא זוהו תלמידים בירידה מובהקת</p>}
                </div>
            </div>

            <div className="bg-yellow-50 rounded-2xl p-5 border border-yellow-100 shadow-sm">
                <h3 className="text-yellow-800 font-bold mb-3 flex items-center gap-2">
                    <span className="text-xl">⭐</span> מצטייני התנהגות
                </h3>
                <div className="space-y-3">
                    {topBehavior.filter(t => t.positiveEvents > 0).length > 0 ? topBehavior.filter(t => t.positiveEvents > 0).map(t => (
                        <div key={t.id} className="bg-white p-2 rounded-lg shadow-sm flex justify-between items-center text-sm">
                            <span className="font-medium">{t.name}</span>
                            <span className="text-yellow-600 font-bold">{t.positiveEvents} חיזוקים</span>
                        </div>
                    )) : <p className="text-sm text-yellow-600/70">לא נרשמו חיזוקים מיוחדים</p>}
                </div>
            </div>
        </div>

        {/* Scatter Plot: Grades vs Behavior */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
             <h2 className="text-lg font-bold text-slate-800 mb-2">מיפוי כיתתי: הישגים מול התנהגות</h2>
             <p className="text-sm text-slate-500 mb-6">ציר ה-X: ממוצע ציונים (ימינה = גבוה יותר), ציר ה-Y: אירועי משמעת (למעלה = יותר אירועים).</p>
             
             <div className="relative h-64 border-l border-b border-slate-300 bg-slate-50/50 m-4">
                 {/* Y Axis Label */}
                 <div className="absolute -left-8 top-1/2 -rotate-90 text-xs text-slate-400 font-medium">אירועי משמעת</div>
                 {/* X Axis Label */}
                 <div className="absolute bottom-[-25px] left-1/2 text-xs text-slate-400 font-medium">ממוצע ציונים</div>

                 {trends.map(t => {
                     const x = t.avg;
                     const y = Math.min(t.negativeEvents * 10, 100); 

                     let color = 'bg-blue-500';
                     if (t.avg < 60) color = 'bg-red-500';
                     else if (t.avg > 85 && t.negativeEvents < 2) color = 'bg-emerald-500'; // High achiever, good behavior
                     else if (t.avg > 85 && t.negativeEvents > 3) color = 'bg-orange-500'; // High achiever, bad behavior

                     return (
                         <div 
                            key={t.id}
                            className={`absolute w-3 h-3 rounded-full shadow-sm border border-white hover:scale-150 transition-transform cursor-pointer group ${color}`}
                            style={{ left: `${x}%`, bottom: `${y}%` }}
                         >
                            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10 pointer-events-none">
                                {t.name} (ציון: {t.avg.toFixed(0)}, משמעת: {t.negativeEvents})
                            </div>
                         </div>
                     );
                 })}
             </div>
        </div>

        {/* Detailed Table */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800 mb-2">פירוט מלא</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">שם התלמיד</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-1/4">מגמת ציונים</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">ממוצע ציונים (מתוקן)</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">בעיות משמעת/ש.ב</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {trends.map(t => (
                            <tr key={t.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{t.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        {t.trend === 'improving' && <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs font-bold">+{t.diff.toFixed(1)}</span>}
                                        {t.trend === 'declining' && <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded text-xs font-bold">{t.diff.toFixed(1)}</span>}
                                        {t.trend === 'stable' && <span className="text-slate-400 text-xs">יציב</span>}
                                        {t.trend === 'insufficient' && <span className="text-slate-300 text-xs">-</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-700">{t.avg.toFixed(1)}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {t.negativeEvents > 0 ? (
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${t.negativeEvents > 3 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {t.negativeEvents} אירועים
                                        </span>
                                    ) : <span className="text-slate-300 text-xs">-</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};