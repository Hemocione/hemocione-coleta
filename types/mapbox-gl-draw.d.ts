declare module "@mapbox/mapbox-gl-draw" {
  export default class MapboxDraw {
    constructor(options?: any);
    add(geojson: any): void;
    deleteAll(): void;
    getAll(): any;
    changeMode(mode: string): void;
  }
}
