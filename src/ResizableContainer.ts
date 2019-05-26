import { Dialog } from "./Dialog";
import { ResizeHandle } from "./ResizeHandle";
import { EventHandler } from "./EventHandler";
import { DraggableContainer } from "./DraggableContainer";
import { DockManager } from "./DockManager";
import { IDockContainer } from "./IDockContainer";
import { ContainerType } from "./ContainerType";

/**
 * Decorates a dock container with resizer handles around its base element
 * This enables the container to be resized from all directions
 */
export class ResizableContainer implements IDockContainer {
    
    topLevelElement: HTMLDivElement;
    dialog: Dialog;
    delegate: IDockContainer;
    dockManager: DockManager;
    containerElement: HTMLDivElement;
    containerType: ContainerType;
    
    constructor(dialog: Dialog, delegate: IDockContainer, topLevelElement) {
        this.dialog = dialog;
        this.delegate = delegate;
        this.containerElement = delegate.containerElement;
        this.dockManager = delegate.dockManager;
        this.topLevelElement = topLevelElement;
        this.containerType = delegate.containerType;
        this.topLevelElement.style.marginLeft = this.topLevelElement.offsetLeft + 'px';
        this.topLevelElement.style.marginTop = this.topLevelElement.offsetTop + 'px';
        this.minimumAllowedChildNodes = delegate.minimumAllowedChildNodes;
        this._buildResizeHandles();
        this.readyToProcessNextResize = true;
        this.dockSpawnResizedEvent = new CustomEvent("DockSpawnResizedEvent");
    }

    setActiveChild(/*child*/) {
    }

    _buildResizeHandles() {
        this.resizeHandles = [];
        //    this._buildResizeHandle(true, false, true, false); // Dont need the corner resizer near the close button
        this._buildResizeHandle(false, true, true, false);
        this._buildResizeHandle(true, false, false, true);
        this._buildResizeHandle(false, true, false, true);

        this._buildResizeHandle(true, false, false, false);
        this._buildResizeHandle(false, true, false, false);
        this._buildResizeHandle(false, false, true, false);
        this._buildResizeHandle(false, false, false, true);
    }

    _buildResizeHandle(east, west, north, south) {
        var handle = new ResizeHandle();
        handle.east = east;
        handle.west = west;
        handle.north = north;
        handle.south = south;

        // Create an invisible div for the handle
        handle.element = document.createElement('div');
        this.topLevelElement.appendChild(handle.element);

        // Build the class name for the handle
        let verticalClass = '';
        let horizontalClass = '';
        if (north) verticalClass = 'n';
        if (south) verticalClass = 's';
        if (east) horizontalClass = 'e';
        if (west) horizontalClass = 'w';
        let cssClass = 'resize-handle-' + verticalClass + horizontalClass;
        if (verticalClass.length > 0 && horizontalClass.length > 0)
            handle.corner = true;

        handle.element.classList.add(handle.corner ? 'resize-handle-corner' : 'resize-handle');
        handle.element.classList.add(cssClass);
        this.resizeHandles.push(handle);

        handle.mouseDownHandler = new EventHandler(handle.element, 'mousedown', (e) => { this.onMouseDown(handle, e); });
        handle.touchDownHandler = new EventHandler(handle.element, 'touchstart', (e) => { this.onMouseDown(handle, e); });
    }

    saveState(state) {
        this.delegate.saveState(state);
    }

    loadState(state) {
        this.delegate.loadState(state);
    }

    get width(): number {
        return this.delegate.width;
    }

    get height(): number {
        return this.delegate.height;
    }

    get name() {
        return  this.delegate.name;
    }
    set name(value) {
        if (value)
            this.delegate.name = value;
    }

    resize(width, height) {
        this.delegate.resize(width, height);
        this._adjustResizeHandles(width, height);
        document.dispatchEvent(this.dockSpawnResizedEvent);
    }

    _adjustResizeHandles(width, height) {
        var self = this;
        this.resizeHandles.forEach(function (handle) {
            handle.adjustSize(self.topLevelElement, width, height);
        });
    }

    performLayout(children) {
        this.delegate.performLayout(children);
    }

    destroy() {
        this.removeDecorator();
        this.delegate.destroy();
    }

    removeDecorator() {
    }

    onMouseMoved(handle, e) {
        if (e.changedTouches != null) { // TouchMove Event
            e = e.changedTouches[0];
        }

        if (!this.readyToProcessNextResize)
            return;
        this.readyToProcessNextResize = false;

        //    window.requestLayoutFrame(() {
        this.dockManager.suspendLayout();
        var currentMousePosition = new Point(e.clientX, e.clientY);
        var dx = this.dockManager.checkXBounds(this.topLevelElement, currentMousePosition, this.previousMousePosition);
        var dy = this.dockManager.checkYBounds(this.topLevelElement, currentMousePosition, this.previousMousePosition);
        this._performDrag(handle, dx, dy);
        this.previousMousePosition = currentMousePosition;
        this.readyToProcessNextResize = true;
        if (this.dialog.panel)
            this.dockManager.resumeLayout(this.dialog.panel);
    }

    onMouseDown(handle, event) {
        if (event.touches)
            event = event.touches[0];
        this.previousMousePosition = new Point(event.clientX, event.clientY);
        if (handle.mouseMoveHandler) {
            handle.mouseMoveHandler.cancel();
            delete handle.mouseMoveHandler;
        }
        if (handle.touchMoveHandler) {
            handle.touchMoveHandler.cancel();
            delete handle.touchMoveHandler;
        }
        if (handle.mouseUpHandler) {
            handle.mouseUpHandler.cancel();
            delete handle.mouseUpHandler;
        }
        if (handle.touchUpHandler) {
            handle.touchUpHandler.cancel();
            delete handle.touchUpHandler;
        }

        // Create the mouse event handlers
        var self = this;
        handle.mouseMoveHandler = new EventHandler(window, 'mousemove', function (e) { self.onMouseMoved(handle, e); });
        handle.touchMoveHandler = new EventHandler(window, 'touchmove', function (e) { self.onMouseMoved(handle, e); });
        handle.mouseUpHandler = new EventHandler(window, 'mouseup', function (e) { self.onMouseUp(handle, e); });
        handle.touchUpHandler = new EventHandler(window, 'touchend', function (e) { self.onMouseUp(handle, e); });

        document.body.classList.add('disable-selection');
    }

    onMouseUp(handle) {
        handle.mouseMoveHandler.cancel();
        handle.touchMoveHandler.cancel();
        handle.mouseUpHandler.cancel();
        handle.touchUpHandler.cancel();
        delete handle.mouseMoveHandler;
        delete handle.touchMoveHandler;
        delete handle.mouseUpHandler;
        delete handle.touchUpHandler;

        document.body.classList.remove('disable-selection');
    }

    _performDrag(handle, dx, dy) {
        var bounds = {};
        bounds.left = utils.getPixels(this.topLevelElement.style.marginLeft);
        bounds.top = utils.getPixels(this.topLevelElement.style.marginTop);
        bounds.width = this.topLevelElement.clientWidth;
        bounds.height = this.topLevelElement.clientHeight;

        if (handle.east) this._resizeEast(dx, bounds);
        if (handle.west) this._resizeWest(dx, bounds);
        if (handle.north) this._resizeNorth(dy, bounds);
        if (handle.south) this._resizeSouth(dy, bounds);
    }

    _resizeWest(dx, bounds) {
        this._resizeContainer(dx, 0, -dx, 0, bounds);
    }

    _resizeEast(dx, bounds) {
        this._resizeContainer(0, 0, dx, 0, bounds);
    }

    _resizeNorth(dy, bounds) {
        this._resizeContainer(0, dy, 0, -dy, bounds);
    }

    _resizeSouth(dy, bounds) {
        this._resizeContainer(0, 0, 0, dy, bounds);
    }

    _resizeContainer(leftDelta, topDelta, widthDelta, heightDelta, bounds) {
        bounds.left += leftDelta;
        bounds.top += topDelta;
        bounds.width += widthDelta;
        bounds.height += heightDelta;

        var minWidth = 50;  // TODO: Move to external configuration
        var minHeight = 50;  // TODO: Move to external configuration
        bounds.width = Math.max(bounds.width, minWidth);
        bounds.height = Math.max(bounds.height, minHeight);

        this.topLevelElement.style.marginLeft = bounds.left + 'px';
        this.topLevelElement.style.marginTop = bounds.top + 'px';

        this.resize(bounds.width, bounds.height);
    }
}