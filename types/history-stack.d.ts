import { Layer } from "./layer";

export interface Action {
  type: string;
  layer?: Layer;
  layerId?: string;
  oldIndex?: number;
  newIndex?: number;
};

export interface NewLayerAction extends Action {
  type: "NEW_LAYER";
  layer: Layer;
};

export interface DeleteLayerAction extends Action {
  type: "DELETE_LAYER";
  layer: Layer;
  oldIndex: number;
};

export interface PinLayerAction extends Action {
  type: "PIN_LAYER";
  layerId: string;
};

export interface UnPinLayerAction extends Action {
  type: "UNPIN_LAYER";
  layerId: string;
};

export interface HideLayerAction extends Action {
  type: "HIDE_LAYER";
  layerId: string;
};

export interface UnHideLayerAction extends Action {
  type: "UNHIDE_LAYER";
  layerId: string;
};

export interface ReorderLayerAction extends Action {
  type: "REORDER_LAYER";
  oldIndex: number;
  newIndex: number;
};

export interface HistoryStackInterface {
  actions: Action[];
  currentIndex: number;
  push: (action: Action) => void;
  undo: () => Action | null;
  redo: () => Action | null;
  clear: () => void;
};