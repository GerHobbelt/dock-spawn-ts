import { TabHost } from "./TabHost";
import { TabPage } from "./TabPage";
import { Utils } from "./Utils";

/**
 * Specialized tab page that doesn't display the panel's frame when docked in a tab page
 */
export class DocumentTabPage extends TabPage {

    container: any;
    panel: any;
    containerElement: any;

    constructor(host: TabHost, container) {
        super(host, container);

        // If the container is a panel, extract the content element and set it as the tab's content
        if (this.container.containerType === 'panel') {
            this.panel = container;
            this.containerElement = this.panel.elementContent;

            // detach the container element from the panel's frame.
            // It will be reattached when this tab page is destroyed
            // This enables the panel's frame (title bar etc) to be hidden
            // inside the tab page
            Utils.removeNode(this.containerElement);
        }
    }

    destroy() {
        super.destroy();

        // Restore the panel content element back into the panel frame
        Utils.removeNode(this.containerElement);
        this.panel.elementContentHost.appendChild(this.containerElement);
    }
}