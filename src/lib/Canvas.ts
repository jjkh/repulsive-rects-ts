export type Point = { x: number, y: number; };
export type Size = { w: number, h: number; };
export type Rect = { x: number, y: number, w: number, h: number; };
export const contains = (r: Rect, p: Point) => (p.x >= r.x) && (p.y >= r.y) && (p.x <= r.x + r.w) && (p.y <= r.y + r.h);

type ImageScaleType =
    'none'              // draw image at image size, ignoring target rect size (maintaining aspect ratio)
    | 'stretch'         // scale image to fit target rect without maintaining aspect ratio (default)
    | 'fill'            // scale, crop and center the image to fill the target rect (maintaining aspect ratio)
    | 'letterbox'       // scale and center the image without cropping (maintaining aspect ratio)
    | 'letterbox-fill'; // letterbox, with 'fill' image in the background

type Brush = string | CanvasGradient | CanvasPattern;

type PointerEventHandler = (ev: PointerEvent, p: Point) => void;
type KeyEventHandler = (ev: KeyboardEvent) => void;
type WheelEventHandler = (ev: WheelEvent, p: Point) => void;

export type TextAlignment = {
    horizontal: 'left' | 'center' | 'right',
    vertical: 'top' | 'middle' | 'baseline' | 'bottom',
};

export default class Canvas {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;

    #fontFace = 'sans-serif';
    #fontSize = 48;
    devicePixelRatio = 1;

    // resize handler
    onResize?: () => void;

    public get fontFace(): string { return this.#fontFace; }
    public set fontFace(fontFace: string) { this.#fontFace = fontFace; this.#updateFont(); }
    public get fontSize(): number { return this.#fontSize; }

    readonly width: number;
    readonly height: number;
    size: Size;
    public get rect(): Rect { return { x: 0, y: 0, w: this.size.w, h: this.size.h }; }

    public set fontSize(size: number) { this.#fontSize = size; this.#updateFont(); }
    constructor(canvas: HTMLCanvasElement, width: number, height: number) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;

        this.width = width;
        this.height = height;
        this.size = { w: width, h: height };

        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = "high";
    }

    createChild(size: Size = { w: this.width, h: this.height }): Canvas {
        const canvas = new Canvas(document.createElement('canvas'), size.w, size.h);
        canvas.canvas.width = size.w;
        canvas.canvas.height = size.h;
        canvas.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
        return canvas;
    }

    #updateFont() {
        this.ctx.font = `${this.#fontSize}px ${this.fontFace}`;
    }

    clear(style: Brush | null) {
        if (style) {
            this.ctx.fillStyle = style;
            this.ctx.fillRect(0, 0, this.size.w, this.size.h);
        } else {
            this.ctx.clearRect(0, 0, this.size.w, this.size.h);
        }
    }

    drawLine(a: Point, b: Point) {
        this.ctx.beginPath();
        this.ctx.moveTo(a.x, a.y);
        this.ctx.lineTo(b.x, b.y);
        this.ctx.stroke();
    }

    fillRect(rect: Rect, fillStyle?: Brush) {
        if (fillStyle) this.ctx.fillStyle = fillStyle;

        this.ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }

    strokeRect(rect: Rect) {
        this.ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }

    fillRoundRect(rect: Rect, radius: number, fillStyle?: Brush) {
        if (fillStyle) this.ctx.fillStyle = fillStyle;

        // 'borrowed' from https://stackoverflow.com/a/7838871
        if (rect.w < 2 * radius) radius = rect.w / 2;
        if (rect.h < 2 * radius) radius = rect.h / 2;
        this.ctx.beginPath();
        this.ctx.moveTo(rect.x + radius, rect.y);
        this.ctx.arcTo(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h, radius);
        this.ctx.arcTo(rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h, radius);
        this.ctx.arcTo(rect.x, rect.y + rect.h, rect.x, rect.y, radius);
        this.ctx.arcTo(rect.x, rect.y, rect.x + rect.w, rect.y, radius);
        this.ctx.closePath();

        this.ctx.fill();
    }

    strokeRoundRect(rect: Rect, radius: number) {
        // 'borrowed' from https://stackoverflow.com/a/7838871
        if (rect.w < 2 * radius) radius = rect.w / 2;
        if (rect.h < 2 * radius) radius = rect.h / 2;
        this.ctx.beginPath();
        this.ctx.moveTo(rect.x + radius, rect.y);
        this.ctx.arcTo(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h, radius);
        this.ctx.arcTo(rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h, radius);
        this.ctx.arcTo(rect.x, rect.y + rect.h, rect.x, rect.y, radius);
        this.ctx.arcTo(rect.x, rect.y, rect.x + rect.w, rect.y, radius);
        this.ctx.closePath();

        this.ctx.stroke();
    }

    fillCircle(point: Point, radius: number, style?: Brush) {
        if (style) this.ctx.fillStyle = style;

        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawImage(image: ImageBitmap, rect: Rect, mode: ImageScaleType = 'stretch') {
        this.ctx.save();
        const imageRatio = image.width / image.height;
        const rectRatio = rect.w / rect.h;

        let targetRect: Rect = Object.assign({}, rect);
        let cropRect: Rect | null = null;
        switch (mode) {
            case 'fill':
                cropRect = { x: 0, y: 0, w: image.width, h: image.height };
                if (rectRatio > imageRatio) {
                    // image is taller than target rect
                    const cropScale = cropRect.w / targetRect.w;
                    cropRect.h = targetRect.h * cropScale;
                    cropRect.y = (image.height - cropRect.h) / 2;
                } else {
                    // image is wider than target rect
                    const cropScale = cropRect.h / targetRect.h;
                    cropRect.w = targetRect.w * cropScale;
                    cropRect.x = (image.width - cropRect.w) / 2;
                }
                break;
            case 'letterbox-fill':
                this.ctx.filter = 'brightness(120%) blur(8px)';
                this.drawImage(image, rect, 'fill');
                this.ctx.filter = 'drop-shadow(0px 0px 40px #333)';
            case 'letterbox':
                targetRect = calcLetterboxRect({ w: image.width, h: image.height }, targetRect);
                break;
            case 'none':
                // ignore size provided in rect
                targetRect.w = image.width;
                targetRect.h = image.height;
                break;
            case 'stretch':
                // draw rect as-is
                break;
        }

        // draw the image to the canvas
        if (cropRect) {
            // in 'fill' mode, we want to crop the image to the target rect's aspect ratio before drawing it
            this.ctx.drawImage(
                image,
                cropRect.x, cropRect.y, cropRect.w, cropRect.h,
                targetRect.x, targetRect.y, targetRect.w, targetRect.h,
            );
        } else {
            this.ctx.drawImage(image, targetRect.x, targetRect.y, targetRect.w, targetRect.h);
        }

        this.ctx.restore();
    }

    drawCanvas(canvas: Canvas, src?: Rect, dst?: Rect) {
        src ??= canvas.rect;
        dst ??= this.rect;
        this.ctx.drawImage(canvas.canvas,
            src.x, src.y, src.w, src.h,
            dst.x, dst.y, dst.w, dst.h
        );
    }

    drawText(text: string, p: Point) {
        this.drawTextRect(
            text,
            { x: p.x, y: p.y, w: 0, h: 0 },
            { horizontal: 'left', vertical: 'top' },
        );
    }

    strokeText(text: string, p: Point) {
        this.strokeTextRect(
            text,
            { x: p.x, y: p.y, w: 0, h: 0 },
            { horizontal: 'left', vertical: 'top' },
        );
    }

    private canvasPosForText(rect: Rect, alignment: TextAlignment) {
        let pos = { x: rect.x, y: rect.y };

        this.ctx.textAlign = alignment.horizontal;
        switch (alignment.horizontal) {
            case 'left':
                // already fine
                break;
            case 'center':
                pos.x += rect.w / 2;
                break;
            case 'right':
                pos.x += rect.w;
                break;
        }
        this.ctx.textBaseline = 'top';
        switch (alignment.vertical) {
            case 'top':
                // already fine
                break;
            case 'middle':
                this.ctx.textBaseline = 'middle';
                pos.y += rect.h / 2;
                break;
            case 'bottom':
                this.ctx.textBaseline = 'bottom';
                pos.y += rect.h;
                break;
            case 'baseline':
                this.ctx.textBaseline = 'alphabetic';
                pos.y += rect.h;
                break;
        }
        return pos;
    }

    drawTextRect(
        text: string,
        rect: Rect,
        alignment: TextAlignment = { horizontal: 'center', vertical: 'middle' },
    ) {
        const textPos = this.canvasPosForText(rect, alignment);
        this.ctx.fillText(text, textPos.x, textPos.y);
    }

    strokeTextRect(
        text: string,
        rect: Rect,
        alignment: TextAlignment = { horizontal: 'center', vertical: 'middle' },
    ) {
        const textPos = this.canvasPosForText(rect, alignment);
        this.ctx.strokeText(text, textPos.x, textPos.y,);
    }

    setGlobalAlpha(alpha: number, scopedFunc: () => void) {
        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        scopedFunc();
        this.ctx.restore();
    }

    setFilter(filter: string, scopedFunc: () => void) {
        this.ctx.save();
        this.ctx.filter = filter;
        scopedFunc();
        this.ctx.restore();
    }
}

export function calcLetterboxRect(size: Size, bounds: Rect): Rect {
    const innerRatio = size.w / size.h;
    const boundsRatio = bounds.w / bounds.h;

    if (boundsRatio > innerRatio) {
        // inner is taller than bounds
        const new_width = bounds.h * innerRatio;
        return {
            x: bounds.x + (bounds.w - new_width) / 2,
            y: bounds.y,
            w: new_width,
            h: bounds.h,
        };
    } else {
        // inner is wider than bounds
        const new_height = bounds.w / innerRatio;
        return {
            x: bounds.x,
            y: bounds.y + (bounds.h - new_height) / 2,
            w: bounds.w,
            h: new_height,
        };
    }
}

export class MainCanvas extends Canvas {
    pointerMoveHandler?: PointerEventHandler;
    pointerUpHandler?: PointerEventHandler;
    pointerDownHandler?: PointerEventHandler;
    wheelHandler?: WheelEventHandler;

    keyDownHandler?: KeyEventHandler;
    keyUpHandler?: KeyEventHandler;

    constructor(canvas: HTMLCanvasElement) {
        super(canvas, window.innerWidth, window.innerHeight);

        this.ctx = canvas.getContext('2d', { alpha: false })!;

        // mouse events
        this.canvas.addEventListener('pointerenter', ev => this.pointerMoveHandler?.(ev, this.#eventToCanvas(ev)));
        this.canvas.addEventListener('pointerleave', ev => this.pointerMoveHandler?.(ev, this.#eventToCanvas(ev)));
        this.canvas.addEventListener('pointermove', ev => this.pointerMoveHandler?.(ev, this.#eventToCanvas(ev)));
        this.canvas.addEventListener('pointerup', ev => this.pointerUpHandler?.(ev, this.#eventToCanvas(ev)));
        this.canvas.addEventListener('pointerdown', ev => this.pointerDownHandler?.(ev, this.#eventToCanvas(ev)));
        this.canvas.addEventListener('wheel', ev => this.wheelHandler?.(ev, this.#eventToCanvas(ev)), { passive: true });

        // key events
        window.addEventListener('keyup', ev => this.keyUpHandler?.(ev));
        window.addEventListener('keydown', ev => this.keyDownHandler?.(ev));
    }

    #eventToCanvas(ev: MouseEvent): Point {
        return {
            x: ev.offsetX,
            y: ev.offsetY,
        };
    }

    resize(width: number, height: number) {
        this.devicePixelRatio = window.devicePixelRatio ?? 1;
        this.canvas.width = width * this.devicePixelRatio;
        this.canvas.height = height * this.devicePixelRatio;

        this.ctx.scale(devicePixelRatio, devicePixelRatio);

        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        this.size = { w: width, h: height };

        this.onResize?.();
    }
}