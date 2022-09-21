import Canvas, { Point } from "../lib/Canvas";

export default abstract class Scene {
    canvas: Canvas;
    audio?: HTMLAudioElement;

    constructor(canvas: Canvas) {
        this.canvas = canvas;
        this.canvas.canvas.style.cursor = 'default';
    }

    abstract draw(timestamp: DOMHighResTimeStamp): void;

    // optional mouse handlers
    onPointerMove?(ev: PointerEvent, p: Point): void;
    onPointerUp?(ev: PointerEvent, p: Point): void;
    onPointerDown?(ev: PointerEvent, p: Point): void;
    onWheel?(ev: WheelEvent, p: Point): void;

    // optional key handlers
    onKeyUp?(ev: KeyboardEvent): void;
    onKeyDown?(ev: KeyboardEvent): void;
}