import Canvas, { contains, Point, Rect, Size } from "../lib/Canvas";
import Scene from "../lib/Scene";

const grow = (r: Rect, s: number) => { return { x: r.x - s / 2, y: r.y - s / 2, w: r.w + s, h: r.h + s } }
const centre = (r: Rect) => { return { x: r.x + r.w / 2, y: r.y + r.h / 2 } }

export default class ForceGraph extends Scene {
    buttons = [
        new Button(
            { x: 0, y: 0, w: 50, h: 50 },
            '🖐',
            'drag node to move, shift-click to pin/unpin',
            () => { this.activeTool = 'hand'; this.buttons[0].pressed = true; this.buttons[1].pressed = false; }
        ),
        new Button(
            { x: 0, y: 50, w: 50, h: 50 },
            '🔗',
            'drag between nodes to add link, shift-drag to remove',
            () => { this.activeTool = 'link'; this.buttons[1].pressed = true; this.buttons[0].pressed = false; }
        ),
    ]
    activeTool: 'hand' | 'link' = 'hand';

    boxes: Array<Box> = [
        new Box({ w: 120, h: 120 }, 'a'),
        new Box({ w: 110, h: 120 }, 'b'),
        new Box({ w: 120, h: 110 }, 'c'),
        new Box({ w: 110, h: 110 }, 'd'),
        new Box({ w: 120, h: 120 }, 'e'),
        new Box({ w: 110, h: 120 }, 'f'),
        new Box({ w: 120, h: 110 }, 'g'),
        new Box({ w: 110, h: 110 }, 'h'),
    ];

    links = [
        [0, 1],
        [0, 2],
        [1, 2],
        [1, 3],
        [3, 4],
        [4, 5],
        [4, 6],
        [5, 6],
    ];
    lastTime = performance.now();
    state: 'placement' | 'stable' = 'placement';

    hovered?: Box;
    dragging?: Box;
    draggingStart = { x: 0, y: 0 };
    linkAction?: { start: Box, add: boolean };

    constructor(canvas: Canvas) {
        super(canvas);

        this.buttons[0].pressed = true;

        for (let box of this.boxes) {
            box.rect.x = Math.floor(Math.random() * (this.canvas.width - box.rect.w));
            box.rect.y = Math.floor(Math.random() * (this.canvas.height - box.rect.h));
        }
    }

    linked(box: Box): Array<Box> {
        const boxIdx = this.boxes.indexOf(box);
        let linkedBoxes: Array<Box> = [];
        for (const link of this.links) {
            if (link[0] === boxIdx) linkedBoxes.push(this.boxes[link[1]]);
            else if (link[1] === boxIdx) linkedBoxes.push(this.boxes[link[0]]);
        }

        return linkedBoxes;
    }

    draw(timestamp: DOMHighResTimeStamp): void {
        this.canvas.clear('#ccc');

        let delta = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        const screenRect = this.canvas.rect;
        const screenCentre = centre(screenRect);
        for (let i = this.boxes.length - 1; i >= 0; i--) {
            const box = this.boxes[i];
            const linked = this.linked(box);
            if (!box.pinned) {
                // weak force pulling everything to the centre
                box.rect.x += (screenCentre.x - box.centre.x) * delta * 2;
                box.rect.y += (screenCentre.y - box.centre.y) * delta * 2;

                // strong repulsion between nodes (falls off with distance)
                for (let other of this.boxes) {
                    if (box === other) continue;

                    const vec = { x: box.centre.x - other.centre.x, y: box.centre.y - other.centre.y };
                    const len = Math.sqrt(vec.x ** 2 + vec.y ** 2);
                    const norm = { x: vec.x / len, y: vec.y / len };
                    box.rect.x += norm.x * delta * box.mass / 120;
                    box.rect.y += norm.y * delta * box.mass / 120;
                }

                // weak attraction between linked nodes
                for (let other of linked) {
                    const vec = { x: other.centre.x - box.centre.x, y: other.centre.y - box.centre.y };
                    const len = Math.sqrt(vec.x ** 2 + vec.y ** 2);
                    const norm = { x: vec.x / len, y: vec.y / len };
                    box.rect.x += norm.x * delta * (box.mass + other.mass) / 800;
                    box.rect.y += norm.y * delta * (box.mass + other.mass) / 800;
                }
            }
            box.draw(this.canvas);
            this.canvas.fillCircle(box.link, 4, '#666');
        }

        this.canvas.ctx.lineWidth = 2;
        this.canvas.ctx.strokeStyle = '#666';
        for (let link of this.links)
            this.canvas.drawLine(this.boxes[link[0]].link, this.boxes[link[1]].link);

        for (let button of this.buttons)
            button.draw(this.canvas);
    }

    onPointerUp(_ev: PointerEvent, p: Point): void {
        if (this.dragging) {
            this.dragging = undefined;
            return;
        }

        if (this.linkAction) {
            this.linkAction.start.hovered = false;

            for (let box of this.boxes) {
                if (contains(box.rect, p)) {
                    if (box === this.linkAction.start)
                        break;

                    const firstIdx = this.boxes.indexOf(this.linkAction.start);
                    const secondIdx = this.boxes.indexOf(box);
                    let foundDuplicate = false;
                    for (let link of this.links) {
                        foundDuplicate = link.includes(firstIdx) && link.includes(secondIdx);
                        if (foundDuplicate && !this.linkAction.add)
                            this.links = this.links.filter(a => a !== link);
                    }
                    if (!foundDuplicate && this.linkAction.add)
                        this.links.push([firstIdx, secondIdx]);
                }
            }

            this.linkAction.start.hovered = false;
            this.linkAction = undefined;
            return;
        }

        for (let button of this.buttons) {
            if (contains(button.rect, p)) {
                button.onclick();
                return;
            }
        }
    }

    onPointerDown(ev: PointerEvent, p: Point): void {
        if (this.dragging || this.linkAction) return;

        for (let box of this.boxes) {
            if (contains(box.rect, p)) {
                if (this.activeTool === 'hand') {
                    // pin/unpin
                    if (ev.shiftKey) {
                        box.pinned = !box.pinned;
                        return;
                    }

                    this.draggingStart = { x: p.x - box.rect.x, y: p.y - box.rect.y };
                    this.dragging = box;
                    this.dragging.hovered = true;
                    this.dragging.pinned = true;
                }
                else if (this.activeTool === 'link') {
                    this.linkAction = { start: box, add: !ev.shiftKey };
                    this.hovered = undefined;
                    box.hovered = true;
                }
            }
        }
    }

    onPointerMove(_ev: PointerEvent, p: Point): void {
        if (this.dragging) {
            this.dragging.rect.x = p.x - this.draggingStart.x;
            this.dragging.rect.y = p.y - this.draggingStart.y;
            return;
        }

        for (let button of this.buttons)
            button.hovered = contains(button.rect, p);

        if (this.hovered) {
            this.hovered.hovered = false;
            this.hovered = undefined;
        }
        for (let box of this.boxes) {
            if (contains(box.rect, p)) {
                if (this.linkAction?.start !== box) {
                    this.hovered = box;
                    this.hovered.hovered = true;
                }
                return;
            }
        }
    }
}

class Box {
    rect: Rect;
    text: string;
    pinned = false;
    hovered = false;

    public get top(): number { return this.rect.y; };
    public get left(): number { return this.rect.x; };
    public get bottom(): number { return this.rect.y + this.rect.h; };
    public get right(): number { return this.rect.x + this.rect.w; };

    public get centre(): Point { return { x: this.rect.x + this.rect.w / 2, y: this.rect.y + this.rect.h / 2 } }
    public get link(): Point { return { x: this.rect.x + this.rect.w / 2, y: this.rect.y + this.rect.h / 8 } }
    public get mass(): number { return (this.rect.w * this.rect.h); } // NOTE: bodgy

    constructor(size: Size, text: string) {
        this.rect = { x: 0, y: 0, ...size };
        this.text = text;
    }

    draw(canvas: Canvas) {
        canvas.fillRect(this.rect, this.hovered ? '#ffefef' : (this.pinned ? '#ddd' : '#fff'));
        canvas.ctx.fillStyle = '#000';
        canvas.fontSize = 24;
        canvas.drawTextRect(this.text, this.rect);

        canvas.ctx.strokeStyle = '#333';
        canvas.ctx.lineWidth = 2;
        canvas.strokeRect(grow(this.rect, -1));
    }
}

class Button {
    rect: Rect;
    text: string;
    onclick: () => void;
    hovered = false;
    pressed = false;
    hoverText: string;

    constructor(rect: Rect, text: string, hoverText: string, onclick: () => void) {
        this.rect = Object.assign({}, rect);
        this.text = text;
        this.hoverText = hoverText;
        this.onclick = onclick;
    }

    draw(canvas: Canvas) {
        canvas.fillRect(this.rect, this.pressed ? '#ccc' : (this.hovered ? '#eee' : '#ddd'));
        canvas.ctx.fillStyle = '#000';
        canvas.fontSize = 24;
        canvas.drawTextRect(this.text, this.rect);
        if (this.hovered) {
            canvas.fontSize = 20;
            canvas.drawTextRect(this.hoverText, { x: this.rect.x + this.rect.w + 10, y: this.rect.y, w: 0, h: this.rect.h }, { vertical: 'middle', horizontal: 'left' })
        }
        canvas.ctx.strokeStyle = '#999';
        canvas.ctx.lineWidth = 1;
        canvas.strokeRect(grow(this.rect, -0.5));
    }
}