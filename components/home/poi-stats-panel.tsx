import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Loader2, X, PieChart as PieChartIcon, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { PoiStat, PoiDetail } from '@/utils/overpass';
import { useState } from 'react';

interface PoiStatsPanelProps {
  stats: PoiStat[];
  details: PoiDetail[];
  loading: boolean;
  onClose: () => void;
  onLocationClick?: (lat: number, lon: number) => void;
}

export const PoiStatsPanel = ({ stats, details, loading, onClose, onLocationClick }: PoiStatsPanelProps) => {
  const [showDetails, setShowDetails] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const total = stats.reduce((sum, item) => sum + item.count, 0);

  // Lọc chi tiết theo category được chọn
  const filteredDetails = selectedCategory 
    ? details.filter(d => d.category === selectedCategory)
    : details;

  // Xử lý khi click vào thanh bar
  const handleBarClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const categoryName = data.activePayload[0].payload.name;
      setSelectedCategory(categoryName);
      setShowDetails(true);
    }
  };

  return (
    <div className="absolute top-4 right-4 z-[1000] w-96 bg-slate-900/95 backdrop-blur shadow-xl rounded-lg border border-slate-700 text-slate-200 overflow-hidden animate-in slide-in-from-right max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-800/50">
        <h3 className="font-semibold flex items-center gap-2 text-white">
          <PieChartIcon size={18} className="text-blue-400" />
          Thống kê khu vực
        </h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
            <Loader2 className="animate-spin text-blue-500" size={32} />
            <span className="text-sm">Đang quét dữ liệu OSM...</span>
          </div>
        ) : stats.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm px-4">
            Không tìm thấy địa điểm quan trọng nào trong vùng chọn.
          </div>
        ) : (
          <>
            {/* Tổng quan */}
            <div className="p-4 border-b border-slate-700">
              <div className="mb-4 text-xs text-slate-400 text-center">
                Tìm thấy tổng cộng <strong className="text-white text-base">{total}</strong> địa điểm
              </div>
              
              {/* BIỂU ĐỒ */}
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={stats} 
                    layout="vertical" 
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    onClick={handleBarClick}
                  >
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
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20} cursor="pointer">
                      {stats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Danh sách category */}
              <div className="mt-4 space-y-2">
                {stats.map((stat) => (
                  <button
                    key={stat.name}
                    onClick={() => {
                      setSelectedCategory(stat.name);
                      setShowDetails(true);
                    }}
                    className="w-full flex items-center justify-between p-2 rounded hover:bg-slate-800/50 transition-colors text-sm group"
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: stat.fill }}
                      />
                      <span className="text-slate-300">{stat.name}</span>
                    </div>
                    <span className="text-slate-400 group-hover:text-white font-medium">
                      {stat.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Nút xem chi tiết */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-center gap-2 p-3 bg-slate-800/50 hover:bg-slate-700/50 transition-colors text-sm font-medium"
            >
              {showDetails ? (
                <>
                  <ChevronUp size={16} />
                  Ẩn chi tiết
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  Xem chi tiết ({details.length} địa điểm)
                </>
              )}
            </button>

            {/* Danh sách chi tiết */}
            {showDetails && (
              <div className="border-t border-slate-700">
                {/* Bộ lọc category */}
                <div className="p-3 bg-slate-800/30 border-b border-slate-700">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        selectedCategory === null
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      Tất cả ({details.length})
                    </button>
                    {stats.map((stat) => (
                      <button
                        key={stat.name}
                        onClick={() => setSelectedCategory(stat.name)}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          selectedCategory === stat.name
                            ? 'text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                        style={{
                          backgroundColor: selectedCategory === stat.name ? stat.fill : undefined
                        }}
                      >
                        {stat.name} ({stat.count})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Danh sách địa điểm */}
                <div className="max-h-96 overflow-y-auto">
                  {filteredDetails.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-sm">
                      Không có địa điểm nào trong danh mục này
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-700">
                      {filteredDetails.map((poi) => {
                        const categoryColor = stats.find(s => s.name === poi.category)?.fill || '#94a3b8';
                        
                        return (
                          <div
                            key={poi.id}
                            className="p-3 hover:bg-slate-800/50 transition-colors group cursor-pointer"
                            onClick={() => onLocationClick?.(poi.lat, poi.lon)}
                          >
                            <div className="flex items-start gap-3">
                              <div 
                                className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform"
                                style={{ backgroundColor: categoryColor + '20' }}
                              >
                                <MapPin size={16} style={{ color: categoryColor }} />
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-white text-sm truncate group-hover:text-blue-400 transition-colors">
                                  {poi.name}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <span 
                                    className="text-xs px-2 py-0.5 rounded"
                                    style={{ 
                                      backgroundColor: categoryColor + '20',
                                      color: categoryColor
                                    }}
                                  >
                                    {poi.category}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {poi.subType}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 mt-1 font-mono">
                                  {poi.lat.toFixed(5)}, {poi.lon.toFixed(5)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};