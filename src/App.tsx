/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Solar, Lunar } from 'lunar-javascript';
import { 
  User, 
  Calendar, 
  Clock, 
  MapPin, 
  Info,
  Layers,
  Activity,
  History,
  Download,
  HelpCircle,
  Hash,
  Sparkles,
  Loader2,
  ChevronRight,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';

// --- Constants & Types ---

type Gender = 'M' | 'F';
type CalendarType = 'Solar' | 'Lunar';

interface PillarInfo {
  gan: string;
  zhi: string;
  tenGodGan: string;
  tenGodZhi: string[];
  hiddenGans: string[];
  elementGan: string;
  elementZhi: string;
}

// Five elements color mapping using CSS variables
const ELEMENT_COLORS: Record<string, string> = {
  '金': 'text-[var(--color-element-metal)]',
  '木': 'text-[var(--color-element-wood)]',
  '水': 'text-[var(--color-element-water)]',
  '火': 'text-[var(--color-element-fire)]',
  '土': 'text-[var(--color-element-earth)]',
};

const ELEMENT_BG: Record<string, string> = {
  '金': 'bg-[var(--color-element-metal)]/10',
  '木': 'bg-[var(--color-element-wood)]/10',
  '水': 'bg-[var(--color-element-water)]/10',
  '火': 'bg-[var(--color-element-fire)]/10',
  '土': 'bg-[var(--color-element-earth)]/10',
};

const TEN_GOD_DESC: Record<string, string> = {
  '比肩': '代表意志、自我、兄弟姊妹。與日主陰陽相同。',
  '劫財': '代表競爭、分享、財產流失、姊妹。與日主陰陽不同。',
  '食神': '代表才華、福氣、表達、食祿。日主所生，陰陽相同。',
  '傷官': '代表聰明、不傳統、特殊技藝、是非。日主所生，陰陽不同。',
  '偏財': '代表意外之財、豪爽、父親、男命之情人。日主所克，陰陽相同。',
  '正財': '代表辛勤所得、穩重、男命之妻子。日主所克，陰陽不同。',
  '七殺': '代表壓力、權威、正義感、男命之子女。克日主，陰陽相同。',
  '正官': '代表規範、名譽、官運、法規。克日主，陰陽不同。',
  '偏印': '代表靈感、直覺、偏激、非正統學問。生我者，陰陽相同。',
  '正印': '代表學問、保護、母愛、正統權力。生我者，陰陽不同。',
  '日主': '代表命主本人，是命盤的核心。',
};

// --- Helper Functions ---

const getElement = (ganOrZhi: string): string => {
  const wood = '甲乙寅卯';
  const fire = '丙丁巳午';
  const earth = '戊己辰戌丑未';
  const metal = '庚辛申酉';
  const water = '壬癸亥子';

  if (wood.includes(ganOrZhi)) return '木';
  if (fire.includes(ganOrZhi)) return '火';
  if (earth.includes(ganOrZhi)) return '土';
  if (metal.includes(ganOrZhi)) return '金';
  if (water.includes(ganOrZhi)) return '水';
  return '';
};

// Component for Hover Tooltip
const TenGodTooltip = ({ name }: { name: string }) => (
  <div className="group relative inline-block cursor-help">
    <span className="underline decoration-dotted decoration-slate-300 underline-offset-4 text-[15px]">{name}</span>
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 bg-slate-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl leading-relaxed">
      <p className="font-bold border-b border-white/20 pb-1 mb-1">{name}</p>
      {TEN_GOD_DESC[name] || '命理術語'}
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
    </div>
  </div>
);

const DEFAULT_DATE = new Date();

export default function App() {
  // --- Form State ---
  const [gender, setGender] = useState<Gender>('M');
  const [calendarType, setCalendarType] = useState<CalendarType>('Solar');
  const [inYear, setInYear] = useState<string>(DEFAULT_DATE.getFullYear().toString());
  const [inMonth, setInMonth] = useState<string>((DEFAULT_DATE.getMonth() + 1).toString());
  const [inDay, setInDay] = useState<string>(DEFAULT_DATE.getDate().toString());
  const [isLeap, setIsLeap] = useState<boolean>(false);
  const [timeStr, setTimeStr] = useState<string>('12:00');
  const [longitude, setLongitude] = useState<number>(120.0);

  // --- AI Analysis State ---
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);

  // --- Calculation Logic ---
  const result = useMemo(() => {
    try {
      if (!inYear || !inMonth || !inDay || !timeStr || isNaN(longitude)) {
        return { isSuccess: false, message: '請輸入完整的出生資訊' };
      }

      const year = parseInt(inYear);
      const month = parseInt(inMonth);
      const day = parseInt(inDay);
      const timeParts = timeStr.split(':');
      const hour = parseInt(timeParts[0]);
      const minute = parseInt(timeParts[1]);

      if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) {
        return { isSuccess: false, message: '日期時間數值無效' };
      }

      // Strict validation per library requirements
      if (year < 1 || year > 3000) return { isSuccess: false, message: '年份需在 1-3000 之間' };
      if (month < 1 || month > 12) return { isSuccess: false, message: '月份需在 1-12 之間' };
      if (day < 1 || day > 31) return { isSuccess: false, message: '日期需在 1-31 之間' };
      if (hour < 0 || hour > 23) return { isSuccess: false, message: '小時需在 0-23 之間' };
      if (minute < 0 || minute > 59) return { isSuccess: false, message: '分鐘需在 0-59 之間' };

      let solarObj: Solar;

      if (calendarType === 'Lunar') {
        // Lunar month in lunar-javascript: negative value means leap month
        const lunarMonth = isLeap ? -month : month;
        const lunar = Lunar.fromYmdHms(year, lunarMonth, day, hour, minute, 0);
        solarObj = lunar.getSolar();
      } else {
        solarObj = Solar.fromYmdHms(year, month, day, hour, minute, 0);
      }

      const originalDate = new Date(
        solarObj.getYear(),
        solarObj.getMonth() - 1,
        solarObj.getDay(),
        solarObj.getHour(),
        solarObj.getMinute()
      );

      if (isNaN(originalDate.getTime())) {
        return { isSuccess: false, message: '無效的日期時間格式' };
      }

      const correctionMinutes = (longitude - 120) * 4;
      const correctedDate = new Date(originalDate.getTime() + correctionMinutes * 60 * 1000);

      const cYear = correctedDate.getFullYear();
      const cMonth = correctedDate.getMonth() + 1;
      const cDay = correctedDate.getDate();
      const cHour = correctedDate.getHours();
      const cMinute = correctedDate.getMinutes();

      if (isNaN(cYear) || isNaN(cMonth) || isNaN(cDay)) {
        return { isSuccess: false, message: '真太陽時校正失敗' };
      }
      
      const solar = Solar.fromYmdHms(cYear, cMonth, cDay, cHour, cMinute, 0);
      const lunarResult = solar.getLunar();
      const eightChar = lunarResult.getEightChar();
      
      const genderInt = gender === 'M' ? 1 : 0;

      const extractPillar = (type: 'Year' | 'Month' | 'Day' | 'Hour'): PillarInfo => {
        let gan = '', zhi = '', tenGodGan = '', tenGodZhi: string[] = [], hiddenGans: string[] = [];
        
        switch (type) {
          case 'Year':
            gan = eightChar.getYearGan();
            zhi = eightChar.getYearZhi();
            tenGodGan = eightChar.getYearShiShenGan();
            tenGodZhi = eightChar.getYearShiShenZhi();
            hiddenGans = eightChar.getYearHideGan();
            break;
          case 'Month':
            gan = eightChar.getMonthGan();
            zhi = eightChar.getMonthZhi();
            tenGodGan = eightChar.getMonthShiShenGan();
            tenGodZhi = eightChar.getMonthShiShenZhi();
            hiddenGans = eightChar.getMonthHideGan();
            break;
          case 'Day':
            gan = eightChar.getDayGan();
            zhi = eightChar.getDayZhi();
            tenGodGan = eightChar.getDayShiShenGan(); 
            tenGodZhi = eightChar.getDayShiShenZhi();
            hiddenGans = eightChar.getDayHideGan();
            break;
          case 'Hour':
            gan = eightChar.getTimeGan();
            zhi = eightChar.getTimeZhi();
            tenGodGan = eightChar.getTimeShiShenGan();
            tenGodZhi = eightChar.getTimeShiShenZhi();
            hiddenGans = eightChar.getTimeHideGan();
            break;
        }

        return {
          gan,
          zhi,
          tenGodGan,
          tenGodZhi,
          hiddenGans,
          elementGan: getElement(gan),
          elementZhi: getElement(zhi),
        };
      };

      const pillars = {
        year: extractPillar('Year'),
        month: extractPillar('Month'),
        day: extractPillar('Day'),
        hour: extractPillar('Hour'),
      };

      const yun = eightChar.getYun(genderInt);
      const daYunList = yun.getDaYun(11);
      const daYunFormatted = daYunList
        .filter((item: any) => item.getGanZhi().length > 0)
        .slice(0, 8)
        .map((item: any) => ({
          age: item.getStartAge(),
          year: item.getStartYear(),
          gan: item.getGanZhi().substring(0, 1),
          zhi: item.getGanZhi().substring(1, 2),
          elementGan: getElement(item.getGanZhi().substring(0, 1)),
          elementZhi: getElement(item.getGanZhi().substring(1, 2)),
        }));

      // Calculate Element Energy Distribution
      const energyMap: Record<string, number> = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 };
      [pillars.year, pillars.month, pillars.day, pillars.hour].forEach(p => {
        energyMap[p.elementGan]++;
        energyMap[p.elementZhi]++;
      });

      const energyData = Object.entries(energyMap).map(([name, value]) => ({ 
        name, 
        value,
        fill: name === '木' ? '#4CAF50' : 
              name === '火' ? '#E53935' : 
              name === '土' ? '#8D6E63' : 
              name === '金' ? '#FBC02D' : '#1E88E5'
      })).filter(x => x.value > 0);

      return {
        originalDate,
        correctedDate,
        pillars,
        daYun: daYunFormatted,
        energyData,
        isSuccess: true,
        calendarInfo: calendarType === 'Lunar' ? `農曆 ${inYear}年${isLeap ? '閏' : ''}${inMonth}月${inDay}日` : `公曆 ${inYear}/${inMonth}/${inDay}`
      };
    } catch (e) {
      console.error(e);
      return { isSuccess: false, message: '極端日期或邏輯運算錯誤' };
    }
  }, [gender, calendarType, inYear, inMonth, inDay, isLeap, timeStr, longitude]);

  const startAnalysis = async () => {
    if (!result.isSuccess) return;
    
    setAnalysisLoading(true);
    setAnalysisResult(null);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Missing GEMINI_API_KEY");
      }
      const ai = new GoogleGenAI({ apiKey });
      
      const baziData = {
        gender: gender === 'M' ? '男' : '女',
        calendar: (result as any).calendarInfo,
        pillars: {
          year: { gan: result.pillars.year.gan, zhi: result.pillars.year.zhi, tenGod: result.pillars.year.tenGodGan, hidden: result.pillars.year.hiddenGans },
          month: { gan: result.pillars.month.gan, zhi: result.pillars.month.zhi, tenGod: result.pillars.month.tenGodGan, hidden: result.pillars.month.hiddenGans },
          day: { gan: result.pillars.day.gan, zhi: result.pillars.day.zhi, tenGod: '日主', hidden: result.pillars.day.hiddenGans },
          hour: { gan: result.pillars.hour.gan, zhi: result.pillars.hour.zhi, tenGod: result.pillars.hour.tenGodGan, hidden: result.pillars.hour.hiddenGans },
        },
        energy: result.energyData.map(e => ({ name: e.name, value: e.value })),
        daYun: result.daYun.map(dy => ({ age: dy.age, year: dy.year, ganZhi: dy.gan + dy.zhi })),
      };

      const prompt = `你是一位「AI 命理分析專家」，結合了資深網頁開發者的邏輯感，以及《淵海子平》、《三命通會》、《滴天髓》的深厚八字造詣。
目前時間為西元 2026 年（丙午年）。
請針對以下八字數據（JSON 格式）進行深度分析：

${JSON.stringify(baziData, null, 2)}

請依序執行並以繁體中文回覆：
1. **日主本質與旺衰**：分析日干五行屬性，結合月令氣候與地支通根情況，判斷身強或身弱。
2. **格局判定**：依據月支藏干透出於天干的情況或地支會合，精確判定命局格神（如正官格、食神格、建祿格等）。
3. **職場特質與定位**：捨棄特定職業假設，直接將命局中最強旺或關鍵的「十神」轉化為職場優勢。例如：印星多者適合研發規劃、食傷旺者適合創意開發、官殺重者適合成就導向。並提供具體的「執行力」優化策略。
4. **五行平衡與生活優化**：量化五行過旺或缺失，提供生活化的色彩選擇、居家/辦公室方位建議，以及日常行為調整建議。
5. **歲運批導**：簡述 2026 丙午年對於該命盤的引動影響（如財官消長、情緒起伏等）。

回覆原則：
- 專業中立：嚴禁迷信或恐嚇語氣，秉持「君子問禍不問福」。
- 多元觀點：遇爭議格局時，需同時列舉「轉化」與「挑戰」兩種解讀。
- 數據驅動：分析內容需與提供的 JSON 數據緊密結合。`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
      });
      
      setAnalysisResult(response.text || "無法生成分析結果。");
    } catch (error) {
      console.error("Analysis Error:", error);
      setAnalysisResult("分析過程中發生錯誤，請確認網路連線或稍後再試。");
    } finally {
      setAnalysisLoading(false);
    }
  };

  if (!result.isSuccess) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-6 font-sans text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-8 rounded-3xl shadow-lg border border-slate-200"
        >
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <HelpCircle className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2 font-serif">資料初始化</h1>
          <p className="text-slate-500 text-sm leading-relaxed mb-8">
            {(result as any).message || '請輸入正確的出生資訊，系統將為您生成專業子平八字命盤。'}
          </p>
          <div className="space-y-3">
            <button 
              onClick={() => {
                setInYear(DEFAULT_DATE.getFullYear().toString());
                setInMonth((DEFAULT_DATE.getMonth() + 1).toString());
                setInDay(DEFAULT_DATE.getDate().toString());
                setTimeStr('12:00');
                setLongitude(120.0);
                setCalendarType('Solar');
              }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all"
            >
              載入預設時間
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-slate-800 font-sans pb-20 overflow-x-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center shadow-indigo-100 shadow-xl">
              <Layers className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight font-serif text-slate-900">子平八字<span className="text-indigo-600">專業版</span></h1>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all active:scale-95">
            <Download className="w-3.5 h-3.5" />
            匯出 PDF
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Input Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/20 overflow-hidden sticky top-24">
            <div className="p-6 border-b border-slate-50">
              <h2 className="flex items-center gap-2 font-bold text-slate-900 font-serif">
                <User className="w-4 h-4 text-indigo-500" />
                命主輸入
              </h2>
            </div>
            <div className="p-6 space-y-5">
              {/* Gender Selection */}
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setGender('M')}
                  className={`py-3 px-4 rounded-2xl text-[15px] font-bold transition-all flex items-center justify-center gap-2 ${gender === 'M' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-500'}`}
                >
                  乾造 (男)
                </button>
                <button 
                  onClick={() => setGender('F')}
                  className={`py-3 px-4 rounded-2xl text-[15px] font-bold transition-all flex items-center justify-center gap-2 ${gender === 'F' ? 'bg-rose-500 text-white shadow-lg' : 'bg-slate-50 text-slate-500'}`}
                >
                  坤造 (女)
                </button>
              </div>

              {/* Calendar Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">曆法種類</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setCalendarType('Solar')}
                    className={`py-2 px-3 rounded-xl text-[15px] font-bold transition-all ${calendarType === 'Solar' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}
                  >
                    公曆 (國曆)
                  </button>
                  <button 
                    onClick={() => setCalendarType('Lunar')}
                    className={`py-2 px-3 rounded-xl text-[15px] font-bold transition-all ${calendarType === 'Lunar' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}
                  >
                    農曆 (陰曆)
                  </button>
                </div>
              </div>

              {/* Manual Numerical Date Input */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1 flex justify-between items-center">
                    <span>{calendarType === 'Solar' ? '公曆日期' : '農曆日期'}</span>
                    {calendarType === 'Lunar' && (
                      <label className="flex items-center gap-1 cursor-pointer select-none">
                        <input type="checkbox" checked={isLeap} onChange={e => setIsLeap(e.target.checked)} className="accent-indigo-600" />
                        <span className="text-[9px] normal-case">是否閏月</span>
                      </label>
                    )}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="relative group">
                      <input 
                        type="number" 
                        value={inYear} 
                        onChange={e => setInYear(e.target.value)} 
                        placeholder="年"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-base font-mono focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-center" 
                      />
                      <span className="absolute -top-1.5 right-2 bg-white px-1 text-[8px] font-bold text-slate-300">YEAR</span>
                    </div>
                    <div className="relative group">
                      <input 
                        type="number" 
                        value={inMonth} 
                        onChange={e => setInMonth(e.target.value)} 
                        placeholder="月"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-base font-mono focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-center" 
                      />
                      <span className="absolute -top-1.5 right-2 bg-white px-1 text-[8px] font-bold text-slate-300">MONTH</span>
                    </div>
                    <div className="relative group">
                      <input 
                        type="number" 
                        value={inDay} 
                        onChange={e => setInDay(e.target.value)} 
                        placeholder="日"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-base font-mono focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-center" 
                      />
                      <span className="absolute -top-1.5 right-2 bg-white px-1 text-[8px] font-bold text-slate-300">DAY</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">出生時間</label>
                  <div className="relative">
                    <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="time" value={timeStr} onChange={e => setTimeStr(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-4 py-3 text-base font-mono focus:bg-white focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">地點經度 (°E)</label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="number" step="0.1" value={longitude} onChange={e => setLongitude(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-4 py-3 text-base font-mono focus:bg-white focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all" />
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-50">
               <p className="text-[10px] text-slate-400 leading-relaxed font-medium">輸入為 <span className="text-indigo-600 font-bold">{(result as any).calendarInfo}</span></p>
            </div>
          </div>
        </aside>

        {/* Right Content */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Time Context */}
          <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/20 border border-slate-100 flex flex-col md:flex-row gap-6 items-center">
            <div className="flex-1 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">平太陽時 (輸入)</span>
              <p className="text-lg font-bold text-slate-700 font-serif">{result.originalDate?.toLocaleString('zh-TW', { hour12: false })}</p>
            </div>
            <div className="w-px h-10 bg-slate-100 hidden md:block" />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">真太陽時 (校正)</span>
                <Activity className="w-3 h-3 text-indigo-400" />
              </div>
              <p className="text-lg font-bold text-indigo-600 font-serif">{result.correctedDate?.toLocaleString('zh-TW', { hour12: false })}</p>
            </div>
          </div>

          {/* Ba Zi Core Pillars - The 4-column Grid */}
          <section className="bg-white rounded-[32px] border border-slate-200 shadow-2xl shadow-slate-200/30 overflow-hidden">
            <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100 text-center text-sm font-black text-slate-400 uppercase bg-slate-50/50 py-3">
              <div>年柱</div>
              <div>月柱</div>
              <div>日柱</div>
              <div>時柱</div>
            </div>
            <div className="grid grid-cols-4 divide-x divide-slate-100 items-stretch">
              {[result.pillars.year, result.pillars.month, result.pillars.day, result.pillars.hour].map((p, idx) => {
                const isDayPillar = idx === 2;
                return (
                  <div key={idx} className={`flex flex-col text-center transition-colors pb-8 ${isDayPillar ? 'bg-slate-50/40' : ''}`}>
                    {/* Ten God Gan */}
                    <div className="py-6 px-2 text-xs font-bold text-slate-600">
                      <TenGodTooltip name={p.tenGodGan} />
                    </div>
                    {/* Stems & Branches */}
                    <div className="flex flex-col gap-1 my-2">
                      <div className={`text-5xl font-serif font-medium leading-tight relative flex items-center justify-center h-20 ${ELEMENT_COLORS[p.elementGan]}`}>
                        {isDayPillar && (
                          <div className="absolute inset-0 m-auto w-16 h-16 bg-slate-200/50 rounded-full -z-10 border border-slate-300" />
                        )}
                        {p.gan}
                      </div>
                      <div className={`text-5xl font-serif font-medium leading-tight h-20 ${ELEMENT_COLORS[p.elementZhi]}`}>
                        {p.zhi}
                      </div>
                    </div>
                    {/* Element Indicators */}
                    <div className="flex justify-center gap-1 mt-1 mb-8">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase text-white ${nameToHex(p.elementGan)}`}>{p.elementGan}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase text-white ${nameToHex(p.elementZhi)}`}>{p.elementZhi}</span>
                    </div>
                    {/* Hidden Gains & Ten Gods */}
                    <div className="mt-auto px-4 space-y-2.5">
                      {p.hiddenGans.map((h, hIdx) => (
                        <div key={hIdx} className="flex items-center justify-between group">
                          <span className={`text-sm font-bold ${ELEMENT_COLORS[getElement(h)]}`}>{h}</span>
                          <span className="text-[10px] font-bold text-slate-400 border border-slate-100 px-1.5 py-0.5 rounded group-hover:bg-slate-100 transition-colors">
                            {p.tenGodZhi[hIdx]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Energy Distribution & Da Yun */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Energy Chart */}
            <section className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl shadow-slate-200/10">
              <h3 className="text-sm font-bold text-slate-900 mb-6 font-serif border-l-4 border-indigo-500 pl-3">五行能量分佈</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={result.energyData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {result.energyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                    />
                    <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Pillar Strength or Info */}
            <section className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl shadow-slate-200/10 flex flex-col justify-center">
               <div className="space-y-4">
                  <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <h4 className="text-xs font-bold text-indigo-900 mb-1 flex items-center gap-2">
                       <Info className="w-3 h-3" /> 排盤精要
                    </h4>
                    <p className="text-[11px] text-indigo-700 leading-relaxed font-medium">
                      本盤採《淵海子平》真訣。日主為 <span className="underline decoration-indigo-300 underline-offset-2">{result.pillars.day.gan}</span>，坐地支 <span className="underline decoration-indigo-300 underline-offset-2">{result.pillars.day.zhi}</span>。五行分佈顯示均衡程度（僅計原局八字）。
                    </p>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {Object.entries(ELEMENT_COLORS).map(([name, colorClass]) => (
                      <div key={name} className="flex flex-col items-center gap-1.5 p-2 bg-slate-50/50 rounded-xl">
                        <div className={`w-3 h-3 rounded-full ${nameToHex(name)}`} />
                        <span className={`text-[10px] font-bold ${colorClass}`}>{name}</span>
                      </div>
                    ))}
                  </div>
               </div>
            </section>
          </div>

          {/* Da Yun - Horizontal Scroll */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 font-serif flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-500" />
                大運流年
              </h3>
              <p className="text-[10px] font-bold text-slate-400 italic">← 橫向滑動查看更多 →</p>
            </div>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-6 px-1">
              {result.daYun.map((dy, idx) => (
                <motion.div 
                  key={idx}
                  whileHover={{ y: -5 }}
                  className="flex-shrink-0 w-36 bg-white border border-slate-200 rounded-3xl shadow-lg shadow-slate-200/20 overflow-hidden text-center"
                >
                  <div className="bg-slate-900 py-3">
                    <p className="text-[10px] font-black text-white/50 uppercase">大運 {idx + 1}</p>
                  </div>
                  <div className="p-5 flex flex-col items-center gap-4">
                    <div className="flex flex-col items-center leading-none mt-1">
                      <span className={`text-3xl font-serif font-bold ${ELEMENT_COLORS[dy.elementGan]}`}>{dy.gan}</span>
                      <span className={`text-3xl font-serif font-bold mt-1.5 ${ELEMENT_COLORS[dy.elementZhi]}`}>{dy.zhi}</span>
                    </div>
                    <div className="w-full h-px bg-slate-100" />
                    <div className="space-y-1">
                      <p className="text-xl font-black text-indigo-600 font-mono leading-none">{dy.age}</p>
                      <p className="text-[10px] font-bold text-slate-400">歲起運</p>
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{dy.year} 年</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Professional Analysis Section */}
          <section className="bg-white rounded-[32px] border border-slate-200 shadow-2xl shadow-indigo-100/20 overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-gradient-to-r from-white to-indigo-50/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                  <Sparkles className="text-white w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 font-serif leading-none mb-1">專業解盤分析</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI Professional Interpretation</p>
                </div>
              </div>
              <button 
                onClick={startAnalysis}
                disabled={analysisLoading}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 shadow-md ${
                  analysisLoading 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                }`}
              >
                {analysisLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4" />
                    開始解盤
                  </>
                )}
              </button>
            </div>

            <div className="p-8 min-h-[200px] relative">
              <AnimatePresence mode="wait">
                {analysisLoading ? (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-12 space-y-4"
                  >
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map(i => (
                        <motion.div 
                          key={i}
                          animate={{ y: [0, -8, 0] }}
                          transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                          className="w-2.5 h-2.5 bg-indigo-500 rounded-full"
                        />
                      ))}
                    </div>
                    <p className="text-sm font-bold text-slate-400 animate-pulse">正在調研《淵海子平》與《三命通會》精要...</p>
                  </motion.div>
                ) : analysisResult ? (
                  <motion.div 
                    key="result"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="prose prose-slate max-w-none prose-sm prose-headings:font-serif prose-headings:text-slate-900 prose-p:text-slate-600 prose-p:leading-relaxed prose-strong:text-indigo-600"
                  >
                    <div className="markdown-body">
                      <Markdown>{analysisResult}</Markdown>
                    </div>
                    
                    <div className="mt-8 pt-8 border-t border-slate-100">
                      <button 
                        onClick={() => setShowJson(!showJson)}
                        className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        <Hash className="w-3 h-3" />
                        {showJson ? '隱藏數據內容' : '檢視排盤數據 (JSON)'}
                      </button>
                      {showJson && (
                        <motion.pre 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          className="mt-4 p-4 bg-slate-900 rounded-xl overflow-x-auto text-[10px] font-mono text-indigo-300 leading-relaxed shadow-inner"
                        >
                          {JSON.stringify({
                            gender: gender === 'M' ? '男' : '女',
                            calendar: (result as any).calendarInfo,
                            pillars: result.pillars,
                            energy: result.energyData,
                            daYun: result.daYun
                          }, null, 2)}
                        </motion.pre>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-12 text-center"
                  >
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                      <Sparkles className="w-8 h-8 text-slate-200" />
                    </div>
                    <p className="text-sm font-bold text-slate-400 max-w-[280px] leading-relaxed">
                      點擊「開始解盤」按鈕，<br />
                      AI 將為您進行深度格局解析。
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

        </div>
      </main>

      <footer className="mt-20 py-16 border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 text-center space-y-4">
          <p className="text-slate-400 text-xs italic">資料參考：120.0°E 中原標準時，節氣交接精確至分鐘。</p>
          <div className="h-px w-20 bg-indigo-100 mx-auto" />
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Zi Ping Professional BaZi Engine • 2026</p>
        </div>
      </footer>
    </div>
  );
}

// Utility to convert element name to Tailwind BG hex proxy
function nameToHex(name: string) {
  switch(name) {
    case '木': return 'bg-[#4CAF50]';
    case '火': return 'bg-[#E53935]';
    case '土': return 'bg-[#8D6E63]';
    case '金': return 'bg-[#FBC02D]';
    case '水': return 'bg-[#1E88E5]';
    default: return 'bg-slate-200';
  }
}
