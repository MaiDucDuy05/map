// components/Chatbot.tsx
import { useState, useRef, useEffect } from 'react';
import { MapAction, useChat, useFeedback } from '@/hooks/useChat';
import { MapControl } from '@/types/map-controls';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { 
  MapPin, 
  MessageCircle, 
  Send, 
  Loader2, 
  ThumbsUp, 
  ThumbsDown,
  ChevronRight,
  MoreVertical,
  Plus,
  Trash2,
  Locate,
  MapPinned,
  Route,
  Navigation,
  Eye
} from 'lucide-react';

interface ChatbotProps {
  userId?: string;
  initialSessionId?: string;
  mapControl?: MapControl;
  persistSession?: boolean;
  onMapAction?: (action: MapAction) => void;
}

export default function Chatbot({ 
  userId, 
  initialSessionId,
  mapControl,
  persistSession = true,
  onMapAction
}: ChatbotProps) {
  const { 
    messages, 
    isLoading, 
    sessionId, 
    sendMessage, 
    clearChat,
    startNewSession
  } = useChat({
    sessionId: initialSessionId,
    userId,
    persistSession,
    onMapAction, 
    onError: (error) => {
      console.error('Chat error:', error);
    }
  });

  const { submitFeedback } = useFeedback();
  const [input, setInput] = useState('');
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [showSessionMenu, setShowSessionMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const message = input.trim();
    setInput('');
    await sendMessage(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleSources = (messageId: string) => {
    setExpandedSources(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const toggleLocations = (messageId: string) => {
    setExpandedLocations(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const handleFeedback = async (
    messageId: string,
    message: any,
    type: 'thumbs_up' | 'thumbs_down'
  ) => {
    try {
      await submitFeedback(
        sessionId || '',
        messageId,
        messages[messages.findIndex(m => m.id === messageId) - 1]?.content || '',
        message.content,
        type
      );
    } catch (error) {
      console.error('Feedback error:', error);
    }
  };

  //  Enhanced handleMapAction to support both methods
  const handleMapAction = (action: {
    type: 'flyTo' | 'addMarker' | 'setRoute';
    data: any;
  }) => {
    if (!mapControl) return;

    switch (action.type) {
      case 'flyTo':
        mapControl.flyTo(action.data.lat, action.data.lng, action.data.zoom || 17);
        break;
      case 'addMarker':
        mapControl.addMarker(action.data.lat, action.data.lng, {
          title: action.data.title,
          description: action.data.description,
        });
        break;
      case 'setRoute':
        mapControl.setRoute([action.data.startLat,action.data.startLng], [action.data.endLat,action.data.endLng]);
        break;
    }
  };

  const handleNewSession = () => {
    if (confirm('Bạn có muốn bắt đầu cuộc hội thoại mới? Lịch sử hiện tại sẽ được lưu.')) {
      startNewSession();
      setShowSessionMenu(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">Hướng Dẫn Viên Hà Nội</h2>
            <p className="text-xs text-blue-100">
              {sessionId ? `Session: ${sessionId.slice(0, 8)}...` : 'Chưa có session'}
            </p>
          </div>
        </div>
        
        <div className="relative">
          <button
            onClick={() => setShowSessionMenu(!showSessionMenu)}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Tùy chọn session"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showSessionMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-10">
              <button
                onClick={handleNewSession}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Cuộc hội thoại mới
              </button>
              
              <button
                onClick={() => {
                  clearChat();
                  setShowSessionMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Xóa lịch sử
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <WelcomeScreen onQuickQuestion={sendMessage} />
        ) : (
          messages.map((message) => (
            <div key={message.id}>
              {message.role === 'user' ? (
                <UserMessage content={message.content} />
              ) : (
                <AssistantMessage
                  message={message}
                  onToggleSources={() => toggleSources(message.id)}
                  showSources={expandedSources.has(message.id)}
                  onToggleLocations={() => toggleLocations(message.id)}
                  showLocations={expandedLocations.has(message.id)}
                  onMapAction={handleMapAction}
                  onFeedback={(type) => handleFeedback(message.id, message, type)}
                />
              )}
            </div>
          ))
        )}
        
        {isLoading && <LoadingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Hỏi về địa điểm du lịch Hà Nội..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={1}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Sub-components
function WelcomeScreen({ onQuickQuestion }: { onQuickQuestion: (q: string) => void }) {
  const quickQuestions = [
    "Gợi ý địa điểm ăn uống gần Hồ Gươm",
    "Lịch trình 1 ngày tham quan Hà Nội",
    "Quán cafe view đẹp ở Hà Nội",
    "Chùa Một Cột có gì đặc biệt?",
    "Đánh dấu các địa điểm du lịch nổi tiếng",
    "Tìm đường từ Hồ Gươm đến Văn Miếu",
  ];

  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
        <MessageCircle className="w-8 h-8 text-blue-500" />
      </div>
      
      <h3 className="text-xl font-semibold text-gray-800 mb-2">
        Xin chào! Tôi là hướng dẫn viên du lịch Hà Nội
      </h3>
      <p className="text-gray-600 mb-6">
        Hỏi tôi về địa điểm tham quan, quán ăn ngon, hoặc lịch trình du lịch nhé!
        <br />
        <span className="text-sm text-blue-600">Tôi có thể thao tác trực tiếp trên bản đồ!</span>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
        {quickQuestions.map((q, i) => (
          <button
            key={i}
            onClick={() => onQuickQuestion(q)}
            className="p-3 text-left bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
          >
            <span className="text-sm text-gray-700">{q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] bg-blue-500 text-white rounded-lg px-4 py-3">
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}

function AssistantMessage({ 
  message, 
  onToggleSources, 
  showSources,
  onToggleLocations,
  showLocations,
  onMapAction,
  onFeedback
}: {
  message: any;
  onToggleSources: () => void;
  showSources: boolean;
  onToggleLocations: () => void;
  showLocations: boolean;
  onMapAction?: (action: any) => void;
  onFeedback: (type: 'thumbs_up' | 'thumbs_down') => void;
}) {
  const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null);

  const handleFeedback = (type: 'thumbs_up' | 'thumbs_down') => {
    onFeedback(type);
    setFeedbackGiven(type === 'thumbs_up' ? 'up' : 'down');
  };

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex-shrink-0 flex items-center justify-center text-white text-sm font-semibold">
        AI
      </div>
      
      <div className="flex-1 space-y-2">
        <div className="bg-gray-100 rounded-lg px-4 py-3">
          <div className="markdown-content text-sm text-gray-800">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeSanitize]}
              components={{
                h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-2 text-gray-900" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-lg font-bold mb-2 text-gray-900" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-base font-semibold mb-1.5 text-gray-900" {...props} />,
                h4: ({node, ...props}) => <h4 className="text-sm font-semibold mb-1 text-gray-900" {...props} />,
                p: ({node, ...props}) => <p className="mb-2 leading-relaxed" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
                li: ({node, ...props}) => <li className="ml-2" {...props} />,
                strong: ({node, ...props}) => <strong className="font-semibold text-gray-900" {...props} />,
                em: ({node, ...props}) => <em className="italic" {...props} />,
                code: ({node, inline, ...props}: any) => 
                  inline ? (
                    <code className="bg-gray-200 px-1.5 py-0.5 rounded text-xs font-mono text-red-600" {...props} />
                  ) : (
                    <code className="block bg-gray-800 text-gray-100 p-3 rounded-lg overflow-x-auto text-xs font-mono my-2" {...props} />
                  ),
                pre: ({node, ...props}) => <pre className="bg-gray-800 rounded-lg overflow-hidden my-2" {...props} />,
                blockquote: ({node, ...props}) => (
                  <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 my-2" {...props} />
                ),
                a: ({node, ...props}) => (
                  <a 
                    className="text-blue-600 hover:text-blue-700 underline" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    {...props} 
                  />
                ),
                table: ({node, ...props}) => (
                  <div className="overflow-x-auto my-2">
                    <table className="min-w-full border border-gray-300" {...props} />
                  </div>
                ),
                thead: ({node, ...props}) => <thead className="bg-gray-200" {...props} />,
                th: ({node, ...props}) => <th className="border border-gray-300 px-3 py-2 text-left font-semibold" {...props} />,
                td: ({node, ...props}) => <td className="border border-gray-300 px-3 py-2" {...props} />,
                hr: ({node, ...props}) => <hr className="my-4 border-gray-300" {...props} />,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* ✨ Extracted Locations Section */}
        {message.extractedLocations && message.extractedLocations.length > 0 && (
          <div>
            <button
              onClick={onToggleLocations}
              className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${showLocations ? 'rotate-90' : ''}`} />
              <MapPin className="w-3 h-3" />
              {message.extractedLocations.length} địa điểm được tìm thấy
            </button>
            
            {showLocations && (
              <div className="mt-2 space-y-2">
                {message.extractedLocations.map((location: any, i: number) => (
                  <LocationCard 
                    key={i} 
                    location={location} 
                    onMapAction={onMapAction}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div>
            <button
              onClick={onToggleSources}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${showSources ? 'rotate-90' : ''}`} />
              {message.sources.length} nguồn tham khảo
            </button>
            
            {showSources && (
              <div className="mt-2 space-y-2">
                {message.sources.map((source: any, i: number) => (
                  <SourceCard 
                    key={i} 
                    source={source} 
                    onMapAction={onMapAction}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Map Actions Summary */}
        {message.mapActions && message.mapActions.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
            <div className="flex items-center gap-2 text-xs text-blue-700">
              <Navigation className="w-3 h-3" />
              <span className="font-medium">
                {message.mapActions.length} hành động bản đồ đã thực hiện
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {message.mapActions.map((action: MapAction, i: number) => (
                <span key={i} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded">
                  {getMapActionLabel(action.type)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Feedback */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => handleFeedback('thumbs_up')}
            className={`text-xs flex items-center gap-1 ${
              feedbackGiven === 'up' 
                ? 'text-green-600' 
                : 'text-gray-400 hover:text-green-600'
            }`}
            disabled={feedbackGiven !== null}
          >
            <ThumbsUp className={`w-4 h-4 ${feedbackGiven === 'up' ? 'fill-current' : ''}`} />
            Hữu ích
          </button>
          
          <button
            onClick={() => handleFeedback('thumbs_down')}
            className={`text-xs flex items-center gap-1 ${
              feedbackGiven === 'down' 
                ? 'text-red-600' 
                : 'text-gray-400 hover:text-red-600'
            }`}
            disabled={feedbackGiven !== null}
          >
            <ThumbsDown className={`w-4 h-4 ${feedbackGiven === 'down' ? 'fill-current' : ''}`} />
            Không hữu ích
          </button>
        </div>
      </div>
    </div>
  );
}

// NEW: LocationCard Component
function LocationCard({ 
  location, 
  onMapAction
}: { 
  location: any;
  onMapAction?: (action: any) => void;
}) {
  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-purple-900 mb-1 flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {location.name}
          </h4>
          
          {location.coordinates && (
            <div className="mt-2 space-y-2">
              <span className="text-xs text-purple-600 block">
                📍 {location.coordinates.lat.toFixed(6)}, {location.coordinates.lng.toFixed(6)}
              </span>
              
              {location.visitDuration && (
                <span className="text-xs text-purple-600 block">
                  ⏱️ Thời gian tham quan: {location.visitDuration}
                </span>
              )}
              
              {onMapAction && (
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => onMapAction({
                      type: 'flyTo',
                      data: {
                        lat: location.coordinates.lat,
                        lng: location.coordinates.lng,
                        zoom: 17
                      }
                    })}
                    className="text-xs px-2 py-1 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded font-medium transition-colors flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    Xem
                  </button>
                  
                  <button
                    onClick={() => onMapAction({
                      type: 'addMarker',
                      data: {
                        lat: location.coordinates.lat,
                        lng: location.coordinates.lng,
                        title: location.name,
                        description: `Danh mục: ${location.category || 'N/A'}`
                      }
                    })}
                    className="text-xs px-2 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded font-medium transition-colors flex items-center gap-1"
                  >
                    <MapPinned className="w-3 h-3" />
                    Đánh dấu
                  </button>
                </div>
              )}
            </div>
          )}
          
          <div className="mt-2 flex flex-wrap gap-2">
            {location.category && (
              <span className="text-xs px-2 py-0.5 bg-purple-200 text-purple-800 rounded">
                {location.category}
              </span>
            )}
            
            {location.nearbyRestaurants && location.nearbyRestaurants.length > 0 && (
              <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded">
                🍴 {location.nearbyRestaurants.length} quán ăn gần đây
              </span>
            )}
          </div>
          
          {/* Nearby Restaurants */}
          {location.nearbyRestaurants && location.nearbyRestaurants.length > 0 && (
            <div className="mt-2 pl-2 border-l-2 border-purple-300">
              <p className="text-xs font-medium text-purple-700 mb-1">Quán ăn gần đây:</p>
              <ul className="text-xs text-purple-600 space-y-0.5">
                {location.nearbyRestaurants.slice(0, 3).map((restaurant: string, i: number) => (
                  <li key={i} className="truncate">• {restaurant}</li>
                ))}
                {location.nearbyRestaurants.length > 3 && (
                  <li className="text-purple-500 italic">
                    +{location.nearbyRestaurants.length - 3} quán khác...
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceCard({ 
  source, 
  onMapAction
}: { 
  source: any;
  onMapAction?: (action: any) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <h4 className="text-sm font-medium text-gray-800 mb-1">
            {source.name}
          </h4>
          <p className="text-xs text-gray-600 line-clamp-2">
            {source.content}
          </p>
          
          {source.coordinates && (
            <div className="mt-2 space-y-2">
              <span className="text-xs text-gray-500 block">
                📍 {source.coordinates.lat.toFixed(4)}, {source.coordinates.lng.toFixed(4)}
              </span>
              
              {onMapAction && (
                <div className="flex gap-2">
                  <button
                    onClick={() => onMapAction({
                      type: 'flyTo',
                      data: {
                        lat: source.coordinates.lat,
                        lng: source.coordinates.lng,
                        zoom: 17
                      }
                    })}
                    className="text-xs px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded font-medium transition-colors flex items-center gap-1"
                  >
                    <Locate className="w-3 h-3" />
                    Xem trên bản đồ
                  </button>
                  
                  <button
                    onClick={() => onMapAction({
                      type: 'addMarker',
                      data: {
                        lat: source.coordinates.lat,
                        lng: source.coordinates.lng,
                        title: source.name,
                        description: source.content
                      }
                    })}
                    className="text-xs px-2 py-1 bg-green-50 text-green-600 hover:bg-green-100 rounded font-medium transition-colors flex items-center gap-1"
                  >
                    <MapPinned className="w-3 h-3" />
                    Thêm marker
                  </button>
                </div>
              )}
            </div>
          )}
          
          <div className="mt-2 flex flex-wrap gap-2">
            {source.category && (
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                {source.category}
              </span>
            )}
            {source.tips && source.tips.length > 0 && (
              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                {source.tips.length} tips
              </span>
            )}
            {source.nearbyRestaurants && source.nearbyRestaurants.length > 0 && (
              <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded">
                🍴 {source.nearbyRestaurants.length} quán ăn
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex-shrink-0 flex items-center justify-center text-white text-sm font-semibold">
        AI
      </div>
      <div className="bg-gray-100 rounded-lg px-4 py-3">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

// Helper function
function getMapActionLabel(type: string): string {
  const labels: Record<string, string> = {
    'add_map_marker': 'Thêm marker',
    'create_route': 'Tạo lộ trình',
    'fly_to': 'Di chuyển đến',
    'add_polygon': 'Vẽ vùng',
    'clear_markers': 'Xóa markers',
  };
  return labels[type] || type;
}