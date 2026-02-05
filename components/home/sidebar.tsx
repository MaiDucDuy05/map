import { memo, useContext } from "react";
import { PresentationContext } from "@/app/page";
import LayersPane from "./layers-pane";
import HistoryPane from "./history-pane";

function Sidebar() {
  const { setInspectingLayerId } = useContext(PresentationContext);

  return (
    <div className="bg-slate-600 text-white w-90 flex flex-col justify-between h-screen" onClick={() => setInspectingLayerId(null)}>
      <div className="basis-2/3 flex flex-col overflow-hidden">
        <LayersPane />
      </div>
      <div className="basis-1/3 flex flex-col overflow-hidden border-t border-slate-400">
        <HistoryPane />
      </div>
    </div>
  );
}

export default memo(Sidebar);