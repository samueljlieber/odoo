/** @odoo-module **/

import { browser } from "@web/core/browser/browser";
import { rpcBus } from "@web/core/network/rpc";
import { registry } from "@web/core/registry";
import { useBus, useService } from "@web/core/utils/hooks";
import { Transition } from "@web/core/transition";

import { Component, useState } from "@odoo/owl";

/**
 * Loading Indicator
 *
 * When the user performs an action, it is good to give him some feedback that
 * something is currently happening.  The purpose of the Loading Indicator is to
 * display a small rectangle on the bottom right of the screen with just the
 * text 'Loading' and the number of currently running rpcs.
 *
 * After a delay of 3s, if a rpc is still not completed, we also block the UI.
 */
export class LoadingIndicator extends Component {
    static template = "web.LoadingIndicator";
    static components = { Transition };
    static props = {};

    setup() {
        this.uiService = useService("ui");
        this.state = useState({
            count: 0,
            show: false,
        });
        this.rpcIds = new Set();
        this.shouldUnblock = false;
        this.startShowTimer = null;
        this.blockUITimer = null;
        useBus(rpcBus, "RPC:REQUEST", this.requestCall);
        useBus(rpcBus, "RPC:RESPONSE", this.responseCall);
    }

    requestCall({ detail }) {
        if (detail.settings.silent) {
            return;
        }
        if (this.state.count === 0) {
            browser.clearTimeout(this.startShowTimer);
            this.startShowTimer = browser.setTimeout(() => {
                if (this.state.count) {
                    this.state.show = true;
                }
            }, 250);
        }
        this.rpcIds.add(detail.data.id);
        this.state.count++;
    }

    responseCall({ detail }) {
        if (detail.settings.silent) {
            return;
        }
        this.rpcIds.delete(detail.data.id);
        this.state.count = this.rpcIds.size;
        if (this.state.count === 0) {
            browser.clearTimeout(this.startShowTimer);
            browser.clearTimeout(this.blockUITimer);
            this.state.show = false;
            if (this.shouldUnblock) {
                this.uiService.unblock();
                this.shouldUnblock = false;
            }
        }
    }
}

registry.category("main_components").add("LoadingIndicator", {
    Component: LoadingIndicator,
});
