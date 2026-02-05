import { LatLngBoundsExpression, LatLngTuple, PathOptions } from "leaflet"

export interface BaseLayer {
  type: string,
  uuid: string,
  isPinned: boolean,
  isHidden: boolean,
  realLifeArea?: number, // Area in square meters
  realLifeDistance?: number, // in meters
}

export interface RectLayer extends BaseLayer {
  type: "rectangle"
  bounds: LatLngBoundsExpression
  pathOptions: PathOptions
}

export interface CircleLayer extends BaseLayer {
  type: "circle"
  center: LatLngTuple
  radius: number
  pathOptions: PathOptions
}

export interface ArrowLayer extends BaseLayer {
  type: "arrow"
  start: LatLngTuple
  end: LatLngTuple
  pathOptions: PathOptions
}
export interface TextLayer extends BaseLayer {
  type: "text"
  textContent: string
  textPosition: LatLngTuple
  textColor: string
  textStrokeColor: string
  fontSize: number
}

export type Layer = RectLayer | CircleLayer | ArrowLayer | TextLayer;
