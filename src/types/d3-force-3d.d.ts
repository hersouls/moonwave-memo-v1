/* d3-force-3d (react-force-graph-3d가 쓰는 3차원 d3-force) — 지식 그래프 3D 배치에서 쓰는 만큼만 적어요. */
declare module 'd3-force-3d' {
  export interface Node3D {
    index?: number
    x?: number
    y?: number
    z?: number
    vx?: number
    vy?: number
    vz?: number
    fx?: number | null
    fy?: number | null
    fz?: number | null
  }
  type Acc<N, T> = T | ((d: N, i: number) => T)
  export interface Force<N> {
    (alpha: number): void
    initialize?(nodes: N[], ...rest: unknown[]): void
  }
  export interface Simulation<N> {
    tick(iterations?: number): this
    stop(): this
    alpha(): number
    alpha(a: number): this
    force(name: string, force: Force<N> | null): this
    numDimensions(n: 1 | 2 | 3): this
  }
  export function forceSimulation<N extends Node3D>(nodes?: N[], numDimensions?: 1 | 2 | 3): Simulation<N>
  export interface LinkForce<N, L> extends Force<N> {
    id(fn: (d: N) => string): this
    distance(d: Acc<L, number>): this
    strength(s: Acc<L, number>): this
  }
  export function forceLink<N, L>(links?: L[]): LinkForce<N, L>
  export interface ManyBody<N> extends Force<N> {
    strength(s: Acc<N, number>): this
    distanceMax(d: number): this
    theta(t: number): this
  }
  export function forceManyBody<N>(): ManyBody<N>
  export interface Positioning<N> extends Force<N> {
    strength(s: Acc<N, number>): this
  }
  export function forceX<N>(x?: Acc<N, number>): Positioning<N>
  export function forceY<N>(y?: Acc<N, number>): Positioning<N>
  export function forceZ<N>(z?: Acc<N, number>): Positioning<N>
  export interface Collide<N> extends Force<N> {
    radius(r: Acc<N, number>): this
    strength(s: number): this
    iterations(n: number): this
  }
  export function forceCollide<N>(radius?: Acc<N, number>): Collide<N>
}
