import { cn } from "@/lib/utils";
import { ChevronUp, Eye, EyeOff, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { memo, useCallback, useContext, useEffect, useRef } from "react";
import { HistoryContext } from "@/app/page";
import { Action } from "@/types/history-stack";

const HistoryRowItem = memo(({
  action,
  index,
  isAtPresent,
  isInTheFuture,
  isInThePast,
  onClick
} : {
  action: Action,
  index: number,
  isAtPresent: boolean,
  isInTheFuture: boolean,
  isInThePast: boolean,
  onClick: any
}) => {
  return (
    <div key={index} className="border-b border-slate-500">
      <button
        className={cn(
          "bg-slate-700 p-2 w-full flex flex-row items-center gap-2 cursor-pointer text-sm",
          isAtPresent && "bg-slate-800",
          isInTheFuture && "opacity-40",
          isInThePast && "opacity-100"
        )}
        onClick={() => onClick(index)}
      >
        {action.type === "NEW_LAYER" ? (
          <>
            <Plus size={16} />
            <p>{action.type} - {action.layer!.uuid.slice(0, 5)}</p>
          </>
        ) : action.type === "DELETE_LAYER" ? (
          <>
            <Trash2 size={16} />
            <p>{action.type} - {action.layer!.uuid.slice(0, 5)}</p>
          </>
        ) : action.type === "PIN_LAYER" ? (
          <>
            <Pin size={16} />
            <p>{action.type} - {action.layerId!.slice(0, 5)}</p>
          </>
        ) : action.type === "UNPIN_LAYER" ? (
          <>
            <PinOff size={16} />
            <p>{action.type} - {action.layerId!.slice(0, 5)}</p>
          </>
        ) : action.type === "HIDE_LAYER" ? (
          <>
            <EyeOff size={16} />
            <p>{action.type} - {action.layerId!.slice(0, 5)}</p>
          </>
        ) : action.type === "UNHIDE_LAYER" ? (
          <>
            <Eye size={16} />
            <p>{action.type} - {action.layerId!.slice(0, 5)}</p>
          </>
        ) : action.type === "REORDER_LAYER" ? (
          <>
            <ChevronUp size={16} />
            <p>{action.type} - {action.oldIndex} to {action.newIndex}</p>
          </>
        ) : (
          <>
            <p>{action.type}</p>
          </>
        )}
      </button>
    </div>
  )
});

export default function HistoryPane() {
  const {
    slideHistory,
    undo,
    redo
  } = useContext(HistoryContext);

  const historyBoardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    historyBoardRef.current?.scrollTo({
      top: historyBoardRef.current.scrollHeight,
      behavior: 'smooth'
    });
  }, [slideHistory]);

  const handleSelectHistoryItem = useCallback((index: number) => {
    let diff:number = index - slideHistory.currentIndex;
    while (diff > 0) {
      redo();
      diff--;
    }
    while (diff < 0) {
      undo();
      diff++;
    }
  }, [slideHistory, undo, redo]);

  return (
  <>
    <p className="text-white text-2xl m-2 mb-4">History ({slideHistory.actions.length})</p>
    <div className="h-full overflow-y-auto" ref={historyBoardRef}>
      {slideHistory.actions.map((action, index) => (
        <HistoryRowItem
          key={index}
          action={action}
          index={index}
          isAtPresent={slideHistory.currentIndex === index}
          isInTheFuture={slideHistory.currentIndex < index}
          isInThePast={slideHistory.currentIndex > index}
          onClick={handleSelectHistoryItem}
        />
      ))}
    </div>
  </>
  )
}
