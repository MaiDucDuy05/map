import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Loader2, X, PieChart as PieChartIcon } from 'lucide-react';
import { PoiStat } from '@/utils/overpass';

interface PoiStatsPanelProps {
  stats: PoiStat[];
  loading: boolean;
  onClose: () => void;
}

export const PoiStatsPanel = ({ stats, loading, onClose }: PoiStatsPanelProps) => {
  const total = stats.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="absolute top-4 right-4 z-[1000] w-80 bg-slate-900/95 backdrop-blur shadow-xl rounded-lg border border-slate-700 text-slate-200 overflow-hidden animate-in slide-in-from-right">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-800/50">
        <h3 className="font-semibold flex items-center gap-2 text-white">
          <PieChartIcon size={18} className="text-blue-400" />
          Thống kê khu vực
        </h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700">
          <X size={18} />
        </button>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
            <Loader2 className="animate-spin text-blue-500" size={32} />
            <span className="text-sm">Đang quét dữ liệu OSM...</span>
          </div>
        ) : stats.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm">
            Không tìm thấy địa điểm quan trọng nào trong vùng chọn.
          </div>
        ) : (
          <>
            <div className="mb-4 text-xs text-slate-400 text-center">
              Tìm thấy tổng cộng <strong className="text-white text-base">{total}</strong> địa điểm
            </div>
            
            {/* BIỂU ĐỒ */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={80} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                    {stats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
};